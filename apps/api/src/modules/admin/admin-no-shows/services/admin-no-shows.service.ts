import { Injectable } from '@nestjs/common';
import {
  type AdminNoShowList,
  type adminNoShowListQuerySchema,
  ErrorCode,
  type MealType,
  type NoShowActionResult,
  toBusinessDate,
} from '@ennel/shared';
import { type z } from 'zod';
import { AppError } from '../../../../common/errors/app-error';
import { Clock } from '../../../../infrastructure/clock/clock';
import {
  type TransactionClient,
  TransactionRunner,
} from '../../../../infrastructure/database/transaction-runner';
import { GetMessPolicyService } from '../../../mess-config/services/get-mess-policy.service';
import { windowStart } from '../../../no-shows/domain/no-show-rules';
import { NoShowsRepository } from '../../../no-shows/repositories/no-shows.repository';
import { NoShowEngine } from '../../../no-shows/services/no-show-engine.service';
import { NotifyStudentsService } from '../../../notifications/services/notify-students.service';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { AdminNoShowsRepository } from '../repositories/admin-no-shows.repository';

type ListQuery = z.output<typeof adminNoShowListQuerySchema>;
const ACTION_TIMEOUT_MS = 30_000;

/**
 * Admin §J: the No-show list, the appeal queue, outage review and the manual actions. Every
 * change is audited in its transaction and the student is notified of appeal decisions.
 */
@Injectable()
export class AdminNoShowsService {
  constructor(
    private readonly admin: AdminNoShowsRepository,
    private readonly noShows: NoShowsRepository,
    private readonly engine: NoShowEngine,
    private readonly policies: GetMessPolicyService,
    private readonly notify: NotifyStudentsService,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly clock: Clock,
  ) {}

  async list(query: ListQuery): Promise<AdminNoShowList> {
    const policy = await this.policies.execute();
    const from = windowStart(toBusinessDate(this.clock.now()), policy);
    const [{ items, total }, [pendingAppeals, heldForReview]] = await Promise.all([
      this.admin.list(query, from),
      this.admin.queueSizes(),
    ]);
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      pendingAppeals,
      heldForReview,
    };
  }

  /** Approved: the event no longer counts; the disable lifts if the count drops (ADR-0009). */
  decideAppeal(
    staffId: string,
    appealId: string,
    decision: 'APPROVED' | 'REJECTED',
    reason: string | null,
  ): Promise<NoShowActionResult> {
    return this.run(async (tx, now) => {
      const appeal = await this.admin.findAppealEvent(appealId, tx);
      if (!appeal) throw new AppError(ErrorCode.NOT_FOUND, 'This report was not found.');
      if (!(await this.noShows.decideAppeal(appealId, decision, staffId, reason, now, tx))) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, 'This report has already been decided.');
      }
      const { event } = appeal;
      let changed = 0;
      if (decision === 'APPROVED' && event.status !== 'EXCLUDED') {
        const exclusion = { cause: 'APPEAL_APPROVED' as const, staffId, reason, now };
        if (await this.noShows.changeStatus(event.id, event.status, 'EXCLUDED', exclusion, tx))
          changed = 1;
        await this.engine.reconsider(event.studentId, event.mealType, now, tx);
      }
      await this.tellAppeal(event.studentId, appealId, decision, reason, tx);
      await this.audit.write(tx, {
        action: decision === 'APPROVED' ? 'no-show.appeal.approve' : 'no-show.appeal.reject',
        entityType: 'no_show_appeal',
        entityId: appealId,
        before: { status: 'PENDING', eventStatus: event.status },
        after: { status: decision, eventId: event.id },
        reason,
      });
      return this.result(event.studentId, event.mealType, changed, now, tx);
    });
  }

  /** BR-NS-7: confirm a No-show held during an outage (it then counts) or dismiss it. */
  reviewHeld(
    staffId: string,
    eventId: string,
    decision: 'CONFIRM' | 'DISMISS',
    reason: string,
  ): Promise<NoShowActionResult> {
    return this.run(async (tx, now) => {
      const event = await this.noShows.findEvent(eventId, tx);
      if (!event) throw new AppError(ErrorCode.NOT_FOUND, 'This No-show was not found.');
      const isConfirm = decision === 'CONFIRM';
      const isChanged = await this.noShows.changeStatus(
        eventId,
        'HELD_FOR_REVIEW',
        isConfirm ? 'COUNTED' : 'EXCLUDED',
        isConfirm ? null : { cause: 'OUTAGE_REVIEW_DISMISSED', staffId, reason, now },
        tx,
      );
      if (!isChanged)
        throw new AppError(
          ErrorCode.VALIDATION_FAILED,
          'This No-show is no longer waiting for review.',
        );
      if (isConfirm) await this.engine.evaluate(event.studentId, event.mealType, eventId, now, tx);
      await this.audit.write(tx, {
        action: isConfirm ? 'no-show.held.confirm' : 'no-show.held.dismiss',
        entityType: 'no_show_event',
        entityId: eventId,
        before: { status: 'HELD_FOR_REVIEW' },
        after: { status: isConfirm ? 'COUNTED' : 'EXCLUDED' },
        reason,
      });
      return this.result(event.studentId, event.mealType, 1, now, tx);
    });
  }

  /** BR-NS-8: exclude the student's counted events for one meal; Default Booking stays as it is. */
  resetCount(staffId: string, studentId: string, mealType: MealType, reason: string) {
    return this.run(async (tx, now) => {
      await this.assertStudent(studentId);
      const policy = await this.policies.execute();
      await this.noShows.lockStudent(studentId, tx);
      const from = windowStart(toBusinessDate(now), policy);
      const changed = await this.noShows.excludeCounted(
        studentId,
        mealType,
        from,
        { staffId, reason, now },
        tx,
      );
      await this.audit.write(tx, {
        action: 'no-show.reset',
        entityType: 'student',
        entityId: studentId,
        after: { mealType, excludedEvents: changed },
        reason,
        isOverride: true,
      });
      return this.result(studentId, mealType, changed, now, tx);
    });
  }

  /** BR-NS-6: staff may switch Default Booking back on at any time, with a reason. */
  reEnable(studentId: string, mealType: MealType, reason: string) {
    return this.run(async (tx, now) => {
      await this.assertStudent(studentId);
      const { isLifted } = await this.engine.reEnable(studentId, mealType, now, tx, true);
      if (!isLifted) {
        throw new AppError(
          ErrorCode.VALIDATION_FAILED,
          'Default Booking is not turned off for this meal.',
        );
      }
      await this.audit.write(tx, {
        action: 'no-show.default-booking.re-enable',
        entityType: 'student',
        entityId: studentId,
        after: { mealType, isAutoDisabled: false },
        reason,
        isOverride: true,
      });
      return this.result(studentId, mealType, 1, now, tx);
    });
  }

  private run(work: (tx: TransactionClient, now: Date) => Promise<NoShowActionResult>) {
    return this.transactions.run((tx) => work(tx, this.clock.now()), {
      timeoutMs: ACTION_TIMEOUT_MS,
    });
  }

  private async assertStudent(studentId: string): Promise<void> {
    if (!(await this.admin.studentExists(studentId))) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Student not found.');
    }
  }

  private async result(
    studentId: string,
    mealType: MealType,
    changed: number,
    now: Date,
    tx: TransactionClient,
  ): Promise<NoShowActionResult> {
    const state = await this.engine.state(studentId, mealType, now, tx);
    return { changed, count: state.count, isAutoDisabled: state.isAutoDisabled };
  }

  private async tellAppeal(
    studentId: string,
    appealId: string,
    decision: 'APPROVED' | 'REJECTED',
    reason: string | null,
    tx: TransactionClient,
  ): Promise<void> {
    const isApproved = decision === 'APPROVED';
    await this.notify.notifyWithin(tx, {
      studentIds: [studentId],
      category: 'NO_SHOW',
      title: isApproved
        ? 'Your No-show report was approved'
        : 'Your No-show report was not approved',
      body: isApproved
        ? 'That No-show no longer counts.'
        : `The No-show stays on your record${reason ? `: ${reason}` : '.'}`,
      relatedEntityType: 'no_show_appeal',
      relatedEntityId: appealId,
      dedupeKey: `no-show-appeal:${appealId}`,
    });
  }
}
