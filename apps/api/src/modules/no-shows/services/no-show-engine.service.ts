import { Injectable } from '@nestjs/common';
import { type MealType, toBusinessDate } from '@ennel/shared';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';
import { SyncStudentBookingsService } from '../../default-preferences/services/sync-student-bookings.service';
import { type MessPolicy } from '../../mess-config/domain/mess-policy';
import { GetMessPolicyService } from '../../mess-config/services/get-mess-policy.service';
import { NotifyStudentsService } from '../../notifications/services/notify-students.service';
import {
  canReEnable,
  countInWindow,
  crossesWarning,
  remainingBeforeDisable,
  shouldAutoDisable,
  windowStart,
} from '../domain/no-show-rules';
import { NoShowsRepository } from '../repositories/no-shows.repository';

const MEAL_NAMES: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
};

export interface MealCountState {
  count: number;
  isAutoDisabled: boolean;
}

/**
 * The no-show engine (Spec §10, BR-NS-3..6, ADR-0009). It runs in the caller's transaction after
 * events are counted or excluded, and is the only place that turns Default Booking off or back
 * on because of No-shows. Upcoming bookings are re-synced whenever the flag changes.
 */
@Injectable()
export class NoShowEngine {
  constructor(
    private readonly noShows: NoShowsRepository,
    private readonly policies: GetMessPolicyService,
    private readonly sync: SyncStudentBookingsService,
    private readonly notify: NotifyStudentsService,
  ) {}

  async state(
    studentId: string,
    mealType: MealType,
    now: Date,
    tx: TransactionClient,
    policy?: MessPolicy,
  ): Promise<MealCountState> {
    const rules = policy ?? (await this.policies.execute());
    const today = toBusinessDate(now);
    const events = await this.noShows.eventsForStudent(
      studentId,
      windowStart(today, rules),
      tx,
      mealType,
    );
    const flags = await this.noShows.preferenceFlags(studentId, tx);
    return {
      count: countInWindow(events, today, rules),
      isAutoDisabled: flags.get(mealType)?.isAutoDisabled ?? false,
    };
  }

  /** After one new counted event: warn at the warning level, disable at the threshold (BR-NS-4/5). */
  async evaluate(
    studentId: string,
    mealType: MealType,
    eventId: string,
    now: Date,
    tx: TransactionClient,
  ): Promise<void> {
    await this.noShows.lockStudent(studentId, tx);
    const policy = await this.policies.execute();
    const { count, isAutoDisabled } = await this.state(studentId, mealType, now, tx, policy);
    if (shouldAutoDisable(count, policy, isAutoDisabled)) {
      const mealId = (await this.noShows.preferenceFlags(studentId, tx)).get(mealType)?.mealId;
      if (mealId && (await this.noShows.setAutoDisabled(studentId, mealId, eventId, now, tx))) {
        await this.sync.execute(studentId, tx);
        await this.tell(studentId, mealType, 'disabled', count, policy, eventId, tx);
      }
      return;
    }
    if (crossesWarning(count - 1, count, policy)) {
      await this.tell(studentId, mealType, 'warning', count, policy, eventId, tx);
    }
  }

  /** After an approved appeal: lift the disable once the count is below the threshold (ADR-0009). */
  async reconsider(studentId: string, mealType: MealType, now: Date, tx: TransactionClient) {
    await this.noShows.lockStudent(studentId, tx);
    const policy = await this.policies.execute();
    const { count, isAutoDisabled } = await this.state(studentId, mealType, now, tx, policy);
    if (canReEnable(count, policy, isAutoDisabled)) {
      await this.lift(studentId, mealType, tx);
      await this.tell(studentId, mealType, 'restored', count, policy, String(now.getTime()), tx);
    }
  }

  /**
   * BR-NS-6: switch Default Booking back on for one meal. Students only below the threshold;
   * staff at any time (`force`). Returns false when there was nothing to lift.
   */
  async reEnable(
    studentId: string,
    mealType: MealType,
    now: Date,
    tx: TransactionClient,
    force: boolean,
  ): Promise<{ isLifted: boolean; state: MealCountState }> {
    await this.noShows.lockStudent(studentId, tx);
    const policy = await this.policies.execute();
    const state = await this.state(studentId, mealType, now, tx, policy);
    if (!state.isAutoDisabled || (!force && !canReEnable(state.count, policy, true))) {
      return { isLifted: false, state };
    }
    await this.lift(studentId, mealType, tx);
    return { isLifted: true, state: { ...state, isAutoDisabled: false } };
  }

  private async lift(studentId: string, mealType: MealType, tx: TransactionClient) {
    const mealId = (await this.noShows.preferenceFlags(studentId, tx)).get(mealType)?.mealId;
    if (mealId && (await this.noShows.clearAutoDisabled(studentId, mealId, tx))) {
      await this.sync.execute(studentId, tx);
    }
  }

  private async tell(
    studentId: string,
    mealType: MealType,
    kind: 'warning' | 'disabled' | 'restored',
    count: number,
    policy: MessPolicy,
    /** What caused it (event ID, or the time of a restore), so each notice is sent once. */
    cause: string,
    tx: TransactionClient,
  ): Promise<void> {
    const meal = MEAL_NAMES[mealType];
    const days = policy.noShowWindowDays;
    const text = {
      warning: {
        title: `${count} No-shows for ${meal}`,
        body: `${remainingBeforeDisable(count, policy)} more in ${days} days will turn off Default Booking for ${meal}.`,
      },
      disabled: {
        title: `Default Booking turned off for ${meal}`,
        body: `You had ${count} No-shows for ${meal} in ${days} days. You can still book ${meal.toLowerCase()} yourself, and switch Default Booking back on once the count is lower.`,
      },
      restored: {
        title: `Default Booking is back on for ${meal}`,
        body: `After your report was approved, your ${meal.toLowerCase()} No-shows are below the limit again.`,
      },
    }[kind];
    await this.notify.notifyWithin(tx, {
      studentIds: [studentId],
      category: 'NO_SHOW',
      ...text,
      dedupeKey: `no-show-${kind}:${mealType}:${cause}`,
    });
  }
}
