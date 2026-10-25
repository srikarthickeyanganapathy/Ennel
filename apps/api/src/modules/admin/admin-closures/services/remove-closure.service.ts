import { Injectable } from '@nestjs/common';
import { type BusinessDate, type ClosureResult, ErrorCode } from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';
import { Clock } from '../../../../infrastructure/clock/clock';
import {
  type TransactionClient,
  TransactionRunner,
} from '../../../../infrastructure/database/transaction-runner';
import { type MealDayRow } from '../../../bookings/repositories/bookings.repository';
import { BookingRestorer } from '../../../bookings/services/booking-restorer.service';
import { type MessPolicy } from '../../../mess-config/domain/mess-policy';
import { GetMessPolicyService } from '../../../mess-config/services/get-mess-policy.service';
import { NotifyStudentsService } from '../../../notifications/services/notify-students.service';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import {
  type AffectedBooking,
  AdminClosuresRepository,
} from '../repositories/admin-closures.repository';
import { formatDay } from './closure-notices';

interface RestoreContext {
  closureId: string;
  date: BusinessDate;
  now: Date;
  policy: MessPolicy;
  tx: TransactionClient;
}

/**
 * ADR-0017, BR-CLOS-2: removing a closure re-runs the resolver for each "Mess closed" booking.
 * Bookings whose intent still holds are restored (using the full-slot fallback if needed);
 * the others are left closed and the student is told they can book again. Slots that have
 * already started are not restored.
 */
@Injectable()
export class RemoveClosureService {
  constructor(
    private readonly closures: AdminClosuresRepository,
    private readonly restorer: BookingRestorer,
    private readonly notify: NotifyStudentsService,
    private readonly policies: GetMessPolicyService,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly clock: Clock,
  ) {}

  async execute(staffId: string, closureId: string, reason: string): Promise<ClosureResult> {
    const now = this.clock.now();
    const policy = await this.policies.execute();
    return this.transactions.run(
      async (tx) => {
        const before = await this.closures.findById(closureId, tx);
        if (!before) throw new AppError(ErrorCode.NOT_FOUND, 'Closure not found.');
        if (!(await this.closures.markRemoved(closureId, staffId, reason, now, tx))) {
          throw new AppError(ErrorCode.VALIDATION_FAILED, 'This closure was already removed.');
        }
        const mealIds = [...(await this.closures.mealIds(before.mealTypes, tx)).values()];
        const affected = await this.closures.bookingsWithStatus(
          before.date,
          mealIds,
          'CANCELLED_BY_CLOSURE',
          tx,
        );
        const context: RestoreContext = { closureId, date: before.date, now, policy, tx };
        let restored = 0;
        for (const booking of affected) if (await this.restore(booking, context)) restored += 1;
        await this.audit.write(tx, {
          action: 'closure.remove',
          entityType: 'mess_closure',
          entityId: closureId,
          before: { status: 'ACTIVE', date: before.date, mealTypes: before.mealTypes },
          after: {
            status: 'REMOVED',
            restoredBookings: restored,
            notRestored: affected.length - restored,
          },
          reason,
        });
        const closure = await this.closures.findById(closureId, tx);
        if (!closure) throw new AppError(ErrorCode.NOT_FOUND, 'Closure not found.');
        return { closure, cancelled: 0, restored, notRestored: affected.length - restored };
      },
      { timeoutMs: 60_000 },
    );
  }

  /** Returns true when the booking is back; the student is told either way. */
  private async restore(affected: AffectedBooking, context: RestoreContext): Promise<boolean> {
    const outcome = await this.restorer.restore(
      {
        bookingId: affected.id,
        studentId: affected.studentId,
        mealId: affected.mealId,
        date: context.date,
        fromStatus: 'CANCELLED_BY_CLOSURE',
        eventType: 'RESTORED_AFTER_CLOSURE',
        policy: context.policy,
        now: context.now,
      },
      context.tx,
    );
    if (outcome.kind === 'SKIPPED') return false;
    if (outcome.kind === 'NO_INTENT') {
      await this.tell(affected, outcome.meal, context, 'you can book again', 'reopened');
      return false;
    }
    if (outcome.kind === 'FULL') {
      await this.tell(
        affected,
        outcome.meal,
        context,
        'your usual slot is now full, so please pick another slot',
        'full',
      );
      return false;
    }
    await this.tell(
      affected,
      outcome.meal,
      context,
      `your booking is restored (${outcome.slotLabel})`,
      'restored',
    );
    return true;
  }

  private async tell(
    booking: AffectedBooking,
    meal: MealDayRow,
    context: RestoreContext,
    outcome: string,
    kind: string,
  ): Promise<void> {
    await this.notify.notifyWithin(context.tx, {
      studentIds: [booking.studentId],
      category: 'BOOKING',
      title: `Mess reopened: ${meal.mealName} on ${formatDay(context.date)}`,
      body: `The mess is open for ${meal.mealName.toLowerCase()} after all, and ${outcome}.`,
      relatedEntityType: 'mess_closure',
      relatedEntityId: context.closureId,
      dedupeKey: `closure-removed:${context.closureId}:${meal.mealType}:${kind}`,
    });
  }
}
