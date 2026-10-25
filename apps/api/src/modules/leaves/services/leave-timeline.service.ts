import { Injectable } from '@nestjs/common';
import { addBusinessDays, type MealPoint, toBusinessDate, toInstant } from '@ennel/shared';
import { Clock } from '../../../infrastructure/clock/clock';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';
import { bookingDeadlines } from '../../bookings/domain/meal-card-rules';
import { type MessPolicy } from '../../mess-config/domain/mess-policy';
import { GetMessPolicyService } from '../../mess-config/services/get-mess-policy.service';
import { ListMealsService } from '../../mess-config/services/list-meals.service';
import { currentPoint, earliestChangePoint, type MealOccurrence } from '../domain/leave-rules';
import { LeavesRepository, mealKey } from '../repositories/leaves.repository';

/** Today and the next two days: enough to find the next open meal at any time of day. */
const LOOKAHEAD_DAYS = 3;

export interface LeaveTimeline {
  now: Date;
  policy: MessPolicy;
  /** First meal a leave may start at or resume from (ADR-0026). */
  earliest: MealPoint;
  /** The meal being served now, or the next one (BR-LEAVE-5). */
  current: MealPoint;
}

/**
 * Where "now" falls among the student's meals. Students are bound by cancellation deadlines;
 * staff only by meals that have not started (ADR-0026).
 */
@Injectable()
export class LeaveTimelineService {
  constructor(
    private readonly leaves: LeavesRepository,
    private readonly meals: ListMealsService,
    private readonly policies: GetMessPolicyService,
    private readonly clock: Clock,
  ) {}

  async build(
    studentId: string,
    actor: 'STUDENT' | 'STAFF',
    tx?: TransactionClient,
  ): Promise<LeaveTimeline> {
    const now = this.clock.now();
    const policy = await this.policies.execute();
    const today = toBusinessDate(now);
    const dates = Array.from({ length: LOOKAHEAD_DAYS }, (_, index) =>
      addBusinessDays(today, index),
    );
    const booked = await this.leaves.bookedSlotStarts(studentId, today, dates.at(-1) ?? today, tx);
    const meals = [...(await this.meals.execute())].sort(
      (a, b) => a.serviceStartMinute - b.serviceStartMinute,
    );
    const occurrences: MealOccurrence[] = dates.flatMap((date) =>
      meals.map((meal) => {
        const slotStart = booked.get(mealKey(date, meal.mealType));
        return {
          point: { date, mealType: meal.mealType },
          cutoffAt:
            slotStart === undefined
              ? toInstant(date, meal.serviceStartMinute)
              : bookedCutoff(date, slotStart, actor, policy),
          serviceEndAt: toInstant(date, meal.serviceEndMinute),
        };
      }),
    );
    return {
      now,
      policy,
      earliest: earliestChangePoint(occurrences, now),
      current: currentPoint(occurrences, now),
    };
  }
}

/** A booked meal: students until its cancellation deadline, staff until the slot starts. */
function bookedCutoff(
  date: string,
  slotStart: number,
  actor: 'STUDENT' | 'STAFF',
  policy: MessPolicy,
): Date {
  return actor === 'STUDENT'
    ? bookingDeadlines(date, slotStart, policy).cancelAt
    : toInstant(date, slotStart);
}
