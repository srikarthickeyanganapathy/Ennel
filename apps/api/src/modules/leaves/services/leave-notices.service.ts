import { Injectable } from '@nestjs/common';
import { type BusinessDate } from '@ennel/shared';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';
import { NotifyStudentsService } from '../../notifications/services/notify-students.service';

const MEAL_NAMES: Record<string, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
};

/** `2026-10-25` → `Sun, 25 Oct`. */
function formatDay(date: BusinessDate): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/** Leave notifications (Admin §K: "approval pauses bookings and notifies the student"). */
@Injectable()
export class LeaveNotices {
  constructor(private readonly notify: NotifyStudentsService) {}

  async decided(
    studentId: string,
    leaveId: string,
    outcome: 'approved' | 'rejected',
    reason: string | null,
    tx: TransactionClient,
  ): Promise<void> {
    await this.notify.notifyWithin(tx, {
      studentIds: [studentId],
      category: 'LEAVE',
      title: outcome === 'approved' ? 'Leave approved' : 'Leave not approved',
      body:
        outcome === 'approved'
          ? 'Your leave is approved. Booked meals in it are paused.'
          : `Your leave request was not approved${reason ? `: ${reason}` : '.'}`,
      relatedEntityType: 'leave',
      relatedEntityId: leaveId,
      dedupeKey: `leave-${outcome}:${leaveId}`,
    });
  }

  /** `at` keeps each staff change its own notice while a retry of the same change stays one. */
  async changedByStaff(
    studentId: string,
    leaveId: string,
    change: 'created' | 'ended' | 'corrected',
    at: Date,
    tx: TransactionClient,
  ): Promise<void> {
    await this.notify.notifyWithin(tx, {
      studentIds: [studentId],
      category: 'LEAVE',
      title: `Leave ${change} by mess staff`,
      body: 'Open Leave Management to see the dates. Your meals have been updated to match.',
      relatedEntityType: 'leave',
      relatedEntityId: leaveId,
      dedupeKey: `leave-${change}:${leaveId}:${at.getTime()}`,
    });
  }

  /** ADR-0006: a paused meal whose slot filled up meanwhile is not moved silently. */
  async slotsFull(
    studentId: string,
    meals: { date: string; mealType: string }[],
    tx: TransactionClient,
  ): Promise<void> {
    for (const meal of meals) {
      const name = MEAL_NAMES[meal.mealType] ?? meal.mealType;
      await this.notify.notifyWithin(tx, {
        studentIds: [studentId],
        category: 'BOOKING',
        title: `Pick a slot: ${name} on ${formatDay(meal.date)}`,
        body: `Your leave ended, but your usual ${name.toLowerCase()} slot is full. Please pick another slot.`,
        dedupeKey: `leave-slot-full:${meal.date}:${meal.mealType}`,
      });
    }
  }
}
