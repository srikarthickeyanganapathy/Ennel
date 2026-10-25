import { Injectable } from '@nestjs/common';
import { type BookingStatus, type BusinessDate, toInstant } from '@ennel/shared';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';
import { type MessPolicy } from '../../mess-config/domain/mess-policy';
import { fallbackOrder } from '../domain/fallback-slot';
import { isDeadlinePassed } from '../domain/meal-card-rules';
import { BookingsRepository, type MealDayRow } from '../repositories/bookings.repository';
import { resolveMeal } from './meal-resolution';
import { SeatAllocator } from './seat-allocator.service';

export interface RestoreRequest {
  bookingId: string;
  studentId: string;
  mealId: string;
  date: BusinessDate;
  /** The status being undone, e.g. CANCELLED_BY_CLOSURE or PAUSED_LEAVE. */
  fromStatus: BookingStatus;
  eventType: 'RESTORED_AFTER_CLOSURE' | 'RESUMED_AFTER_LEAVE';
  policy: MessPolicy;
  now: Date;
}

export type RestoreOutcome =
  | { kind: 'RESTORED'; slotLabel: string; meal: MealDayRow }
  /** Nothing wants this meal booked any more (no Default Booking, rule or one-day booking). */
  | { kind: 'NO_INTENT'; meal: MealDayRow }
  /** The intended slot is full and the policy does not move it (ADR-0006). */
  | { kind: 'FULL'; meal: MealDayRow }
  /** The slot has started, the meal is gone, or the booking changed meanwhile. */
  | { kind: 'SKIPPED' };

/**
 * Brings a closed or paused booking back (ADR-0017, BR-LEAVE-7): re-runs the resolver and, if
 * the meal should be booked, takes a seat in the intended slot or, under AUTO_NEXT_AVAILABLE, the
 * next open slot. Used when a closure is removed and when a leave ends. Callers tell the student.
 */
@Injectable()
export class BookingRestorer {
  constructor(
    private readonly bookings: BookingsRepository,
    private readonly seats: SeatAllocator,
  ) {}

  async restore(request: RestoreRequest, tx: TransactionClient): Promise<RestoreOutcome> {
    const booking = await this.bookings.findBooking(request.bookingId, tx);
    if (
      !booking ||
      isDeadlinePassed(toInstant(request.date, booking.slot.startMinute), request.now)
    )
      return { kind: 'SKIPPED' };
    const day = await this.bookings.loadStudentDay(request.studentId, request.date, tx);
    const meal = day.meals.find((candidate) => candidate.mealId === request.mealId);
    if (!meal) return { kind: 'SKIPPED' };
    const { resolution } = resolveMeal(meal, day, request.date);
    if (resolution.kind !== 'BOOK') return { kind: 'NO_INTENT', meal };
    const seat = await this.findSeat(resolution.slotId, meal, request, tx);
    if (!seat) return { kind: 'FULL', meal };
    const write = {
      status: 'BOOKED' as const,
      slotId: seat.id,
      isOverCapacity: seat.isOverCapacity,
      dietType: resolution.dietType,
      source: resolution.source,
      cancelledAt: null,
    };
    if (!(await this.bookings.updateBooking(booking.id, booking.version, write, tx)))
      return { kind: 'SKIPPED' };
    await this.bookings.addEvent(
      {
        bookingId: booking.id,
        type: request.eventType,
        fromStatus: request.fromStatus,
        toStatus: 'BOOKED',
        payload: { slotId: seat.id },
        actorType: 'SYSTEM',
        actorStaffId: null,
        reason: null,
      },
      tx,
    );
    const slotLabel = meal.slots.find((slot) => slot.id === seat.id)?.label ?? '';
    return { kind: 'RESTORED', slotLabel, meal };
  }

  /** The intended slot, or under AUTO_NEXT_AVAILABLE the first open fallback with a seat (ADR-0006). */
  private async findSeat(
    slotId: string,
    meal: MealDayRow,
    request: RestoreRequest,
    tx: TransactionClient,
  ): Promise<{ id: string; isOverCapacity: boolean } | null> {
    const first = await this.seats.tryReserve(slotId, request.date, request.policy, tx);
    if (first.isAvailable) return { id: slotId, isOverCapacity: first.isOverCapacity };
    if (request.policy.defaultSlotFullFallback !== 'AUTO_NEXT_AVAILABLE') return null;
    const open = meal.slots.filter(
      (slot) => !isDeadlinePassed(toInstant(request.date, slot.startMinute), request.now),
    );
    for (const candidate of fallbackOrder(
      slotId,
      open.map((slot) => ({ slotId: slot.id, startMinute: slot.startMinute })),
    )) {
      const seat = await this.seats.tryReserve(candidate, request.date, request.policy, tx);
      if (seat.isAvailable) return { id: candidate, isOverCapacity: seat.isOverCapacity };
    }
    return null;
  }
}
