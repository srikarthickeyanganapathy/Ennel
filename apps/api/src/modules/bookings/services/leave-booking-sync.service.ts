import { Injectable } from '@nestjs/common';
import { isPointInRange, type MealRange, toBusinessDate, toInstant } from '@ennel/shared';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';
import { type MessPolicy } from '../../mess-config/domain/mess-policy';
import { isDeadlinePassed } from '../domain/meal-card-rules';
import { BookingsRepository, type LeaveBookingRow } from '../repositories/bookings.repository';
import { BookingRestorer } from './booking-restorer.service';

export interface LeaveActor {
  type: 'STUDENT' | 'STAFF';
  staffId: string | null;
  reason: string | null;
}

export interface LeaveSyncResult {
  paused: number;
  resumed: number;
  /** Paused meals that could not be booked again, because the slot is now full (ADR-0006). */
  fullMeals: { date: string; mealType: string }[];
}

/**
 * BR-LEAVE-4, BR-LEAVE-7, BR-LEAVE-8: makes a student's upcoming meals match their approved
 * leaves. Booked meals inside a leave are paused; paused meals no longer covered are restored
 * through the resolver, or cancelled by the system when nothing wants them booked. Meals whose
 * slot has started are never changed. Recurring bookings for uncovered days are created by the
 * caller's Default Booking sync afterwards.
 */
@Injectable()
export class LeaveBookingSync {
  constructor(
    private readonly bookings: BookingsRepository,
    private readonly restorer: BookingRestorer,
  ) {}

  async execute(
    studentId: string,
    leaves: readonly MealRange[],
    context: { actor: LeaveActor; policy: MessPolicy; now: Date },
    tx: TransactionClient,
  ): Promise<LeaveSyncResult> {
    const result: LeaveSyncResult = { paused: 0, resumed: 0, fullMeals: [] };
    const rows = await this.bookings.bookingsForLeave(studentId, toBusinessDate(context.now), tx);
    for (const row of rows) {
      if (isDeadlinePassed(toInstant(row.date, row.slotStartMinute), context.now)) continue;
      const isCovered = leaves.some((leave) =>
        isPointInRange(leave, { date: row.date, mealType: row.mealType }),
      );
      if (row.status === 'BOOKED' && isCovered) {
        if (await this.pause(row, context.actor, tx)) result.paused += 1;
      } else if (row.status === 'PAUSED_LEAVE' && !isCovered) {
        await this.resume(studentId, row, context, tx, result);
      }
    }
    return result;
  }

  private async pause(row: LeaveBookingRow, actor: LeaveActor, tx: TransactionClient) {
    if (!(await this.bookings.updateBooking(row.id, row.version, { status: 'PAUSED_LEAVE' }, tx)))
      return false;
    await this.bookings.addEvent(
      {
        bookingId: row.id,
        type: 'PAUSED_FOR_LEAVE',
        fromStatus: 'BOOKED',
        toStatus: 'PAUSED_LEAVE',
        actorType: actor.type,
        actorStaffId: actor.staffId,
        reason: actor.reason,
      },
      tx,
    );
    return true;
  }

  private async resume(
    studentId: string,
    row: LeaveBookingRow,
    context: { policy: MessPolicy; now: Date },
    tx: TransactionClient,
    result: LeaveSyncResult,
  ): Promise<void> {
    const outcome = await this.restorer.restore(
      {
        bookingId: row.id,
        studentId,
        mealId: row.mealId,
        date: row.date,
        fromStatus: 'PAUSED_LEAVE',
        eventType: 'RESUMED_AFTER_LEAVE',
        policy: context.policy,
        now: context.now,
      },
      tx,
    );
    if (outcome.kind === 'RESTORED') {
      result.resumed += 1;
      return;
    }
    if (outcome.kind === 'SKIPPED') return;
    // Not on leave any more, so it must not stay "Paused"; a system cancellation reads as
    // "Not Booked" and Default Booking can bring it back later (BR-DEF-6).
    const cancelled = await this.bookings.updateBooking(
      row.id,
      row.version,
      {
        status: 'CANCELLED',
        cancelledAt: context.now,
        lastActorType: 'SYSTEM',
        lastActorStaffId: null,
      },
      tx,
    );
    if (cancelled && outcome.kind === 'FULL') {
      result.fullMeals.push({ date: row.date, mealType: row.mealType });
    }
  }
}
