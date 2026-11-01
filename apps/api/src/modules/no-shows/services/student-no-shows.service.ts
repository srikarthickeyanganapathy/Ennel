import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  type MealType,
  type NoShowSummary,
  type StudentNoShowEvent,
  toBusinessDate,
} from '@ennel/shared';
import { AppError } from '../../../common/errors/app-error';
import { Clock } from '../../../infrastructure/clock/clock';
import { TransactionRunner } from '../../../infrastructure/database/transaction-runner';
import { GetMessPolicyService } from '../../mess-config/services/get-mess-policy.service';
import { ListMealsService } from '../../mess-config/services/list-meals.service';
import {
  canAppeal,
  canReEnable,
  countInWindow,
  levelFor,
  remainingBeforeDisable,
  windowStart,
} from '../domain/no-show-rules';
import { NoShowsRepository, type StoredNoShow } from '../repositories/no-shows.repository';
import { NoShowEngine } from './no-show-engine.service';

const SYNC_TIMEOUT_MS = 30_000;

/** Student No-show counts, warnings and "report incorrect record" (Spec §7, §10). */
@Injectable()
export class StudentNoShowsService {
  constructor(
    private readonly noShows: NoShowsRepository,
    private readonly engine: NoShowEngine,
    private readonly meals: ListMealsService,
    private readonly policies: GetMessPolicyService,
    private readonly transactions: TransactionRunner,
    private readonly clock: Clock,
  ) {}

  async summary(studentId: string): Promise<NoShowSummary> {
    const policy = await this.policies.execute();
    const today = toBusinessDate(this.clock.now());
    const [events, flags, meals] = [
      await this.noShows.eventsForStudent(studentId, windowStart(today, policy)),
      await this.noShows.preferenceFlags(studentId),
      await this.meals.execute(),
    ];
    return {
      windowDays: policy.noShowWindowDays,
      warningThreshold: policy.noShowWarningThreshold,
      disableThreshold: policy.noShowDisableThreshold,
      meals: [...meals]
        .sort((a, b) => a.serviceStartMinute - b.serviceStartMinute)
        .map((meal) => {
          const count = countInWindow(
            events.filter((event) => event.mealType === meal.mealType),
            today,
            policy,
          );
          const isAutoDisabled = flags.get(meal.mealType)?.isAutoDisabled ?? false;
          return {
            mealType: meal.mealType,
            mealName: meal.displayName,
            count,
            level: levelFor(count, policy),
            remainingBeforeDisable: remainingBeforeDisable(count, policy),
            isAutoDisabled,
            canReEnable: canReEnable(count, policy, isAutoDisabled),
          };
        }),
      events: events.map((event) => this.toStudentEvent(event, today, policy)),
    };
  }

  /** ADR-0027: one report per event; staff decide it in the appeal queue. */
  async appeal(studentId: string, eventId: string, message: string): Promise<StudentNoShowEvent> {
    const policy = await this.policies.execute();
    const today = toBusinessDate(this.clock.now());
    await this.transactions.run(async (tx) => {
      await this.noShows.lockStudent(studentId, tx);
      const event = await this.noShows.findEvent(eventId, tx);
      if (!event || event.studentId !== studentId) {
        throw new AppError(ErrorCode.NOT_FOUND, 'This No-show was not found.');
      }
      if (!canAppeal(event, event.appeal !== null, today, policy)) {
        throw new AppError(
          ErrorCode.VALIDATION_FAILED,
          event.appeal
            ? 'You already reported this record.'
            : 'This record can no longer be reported.',
        );
      }
      await this.noShows.createAppeal(eventId, studentId, message, tx);
    });
    const event = await this.noShows.findEvent(eventId);
    if (!event) throw new AppError(ErrorCode.NOT_FOUND, 'This No-show was not found.');
    return this.toStudentEvent(event, today, policy);
  }

  /** BR-NS-6: switch Default Booking back on once the count is below the threshold. */
  async reEnable(studentId: string, mealType: MealType): Promise<NoShowSummary> {
    const result = await this.transactions.run(
      (tx) => this.engine.reEnable(studentId, mealType, this.clock.now(), tx, false),
      { timeoutMs: SYNC_TIMEOUT_MS },
    );
    if (!result.isLifted) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        result.state.isAutoDisabled
          ? 'Default Booking can be switched back on once your No-shows for this meal are below the limit.'
          : 'Default Booking was not turned off for this meal.',
      );
    }
    return this.summary(studentId);
  }

  private toStudentEvent(
    event: StoredNoShow,
    today: string,
    policy: Parameters<typeof canAppeal>[3],
  ): StudentNoShowEvent {
    return {
      id: event.id,
      bookingId: event.bookingId,
      date: event.date,
      mealType: event.mealType,
      status: event.status,
      exclusionCause: event.exclusionCause,
      appeal: event.appeal,
      canAppeal: canAppeal(event, event.appeal !== null, today, policy),
    };
  }
}
