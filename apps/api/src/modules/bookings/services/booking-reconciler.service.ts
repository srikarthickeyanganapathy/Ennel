import { Injectable } from '@nestjs/common';
import { BookingStatus, type BusinessDate, toInstant } from '@ennel/shared';
import { Clock } from '../../../infrastructure/clock/clock';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';
import { type MessPolicy } from '../../mess-config/domain/mess-policy';
import { NotifyStudentsService } from '../../notifications/services/notify-students.service';
import { fallbackOrder } from '../domain/fallback-slot';
import { isDeadlinePassed } from '../domain/meal-card-rules';
import { planReconciliation, type ReconcileAction } from '../domain/reconcile-booking';
import {
  type BookingWrite,
  BookingsRepository,
  type MealDayRow,
} from '../repositories/bookings.repository';
import { resolveMeal } from './meal-resolution';
import { SeatAllocator } from './seat-allocator.service';

export interface ReconcileStats {
  created: number;
  reactivated: number;
  updated: number;
  cancelled: number;
  movedToFallback: number;
  askedToChoose: number;
}

interface MealContext {
  studentId: string;
  date: BusinessDate;
  now: Date;
  policy: MessPolicy;
  meal: MealDayRow;
  stats: ReconcileStats;
  tx: TransactionClient;
}

type PlannedBooking = Extract<ReconcileAction, { slotId: string }>;

const SYSTEM_ACTOR = {
  lastActorType: 'SYSTEM',
  lastActorStaffId: null,
  lastOverrideReason: null,
} as const;
const SYSTEM_EVENT = { actorType: 'SYSTEM', actorStaffId: null, reason: null } as const;

export function emptyStats(): ReconcileStats {
  return {
    created: 0,
    reactivated: 0,
    updated: 0,
    cancelled: 0,
    movedToFallback: 0,
    askedToChoose: 0,
  };
}

/**
 * Brings a student's materialized bookings in line with their recurring intent (BR-DEF-1..3):
 * used nightly by the generation job and straight after a preference change. Full slots follow
 * `defaultSlotFullFallback` (ADR-0006); the student is notified either way, never silently moved.
 */
@Injectable()
export class BookingReconciler {
  constructor(
    private readonly bookings: BookingsRepository,
    private readonly seats: SeatAllocator,
    private readonly notify: NotifyStudentsService,
    private readonly clock: Clock,
  ) {}

  async reconcile(
    studentId: string,
    dates: BusinessDate[],
    policy: MessPolicy,
    tx: TransactionClient,
    stats: ReconcileStats = emptyStats(),
  ): Promise<ReconcileStats> {
    const now = this.clock.now();
    for (const date of dates) {
      const day = await this.bookings.loadStudentDay(studentId, date, tx);
      for (const meal of day.meals) {
        const { resolution } = resolveMeal(meal, day, date);
        const action = planReconciliation({
          date,
          now,
          existing: meal.booking && {
            status: meal.booking.status,
            source: meal.booking.source,
            slotId: meal.booking.slot.id,
            slotStartMinute: meal.booking.slot.startMinute,
            dietType: meal.booking.dietType,
            lastActorType: meal.booking.lastActorType,
          },
          resolution,
          slotStarts: new Map(meal.slots.map((slot) => [slot.id, slot.startMinute])),
          policy,
        });
        await this.apply(action, { studentId, date, now, policy, meal, stats, tx });
      }
    }
    return stats;
  }

  private async apply(action: ReconcileAction, context: MealContext): Promise<void> {
    if (action.kind === 'CREATE' || action.kind === 'REACTIVATE') await this.book(action, context);
    else if (action.kind === 'UPDATE') await this.update(action, context);
    else if (action.kind === 'CANCEL') await this.cancel(context);
  }

  private async book(action: PlannedBooking, context: MealContext): Promise<void> {
    const placed = await this.place(action.slotId, context);
    if (!placed) return this.askToChoose(context);
    const write: BookingWrite = {
      ...SYSTEM_ACTOR,
      slotId: placed.slotId,
      dietType: action.dietType,
      status: BookingStatus.BOOKED,
      source: action.source,
      isOverCapacity: placed.isOverCapacity,
      cancelledAt: null,
    };
    const { meal, tx } = context;
    const existing = meal.booking;
    const bookingId = existing
      ? (await this.bookings.updateBooking(existing.id, existing.version, write, tx), existing.id)
      : await this.bookings.createBooking(
          { studentId: context.studentId, mealId: meal.mealId, date: context.date },
          write,
          tx,
        );
    await this.bookings.addEvent(
      {
        ...SYSTEM_EVENT,
        bookingId,
        type: 'CREATED',
        fromStatus: existing?.status ?? null,
        toStatus: BookingStatus.BOOKED,
        payload: { slotId: placed.slotId, dietType: action.dietType, source: action.source },
      },
      tx,
    );
    if (existing) context.stats.reactivated += 1;
    else context.stats.created += 1;
    if (placed.slotId !== action.slotId) await this.tellMoved(placed.slotId, context);
  }

  /** The preferred slot, or under AUTO_NEXT_AVAILABLE the first fallback with a seat. */
  private async place(
    preferredSlotId: string,
    context: MealContext,
  ): Promise<{ slotId: string; isOverCapacity: boolean } | null> {
    const { date, policy, tx } = context;
    const preferred = await this.seats.tryReserve(preferredSlotId, date, policy, tx);
    if (preferred.isAvailable)
      return { slotId: preferredSlotId, isOverCapacity: preferred.isOverCapacity };
    if (policy.defaultSlotFullFallback !== 'AUTO_NEXT_AVAILABLE') return null;
    const open = context.meal.slots.filter(
      (slot) => !isDeadlinePassed(toInstant(date, slot.startMinute), context.now),
    );
    for (const slotId of fallbackOrder(
      preferredSlotId,
      open.map((slot) => ({ slotId: slot.id, startMinute: slot.startMinute })),
    )) {
      const seat = await this.seats.tryReserve(slotId, date, policy, tx);
      if (seat.isAvailable) return { slotId, isOverCapacity: seat.isOverCapacity };
    }
    return null;
  }

  private async update(action: PlannedBooking, context: MealContext): Promise<void> {
    const booking = context.meal.booking;
    if (!booking) return;
    const isSlotChange = booking.slot.id !== action.slotId;
    let isOverCapacity = booking.isOverCapacity;
    if (isSlotChange) {
      const seat = await this.seats.tryReserve(
        action.slotId,
        context.date,
        context.policy,
        context.tx,
      );
      if (!seat.isAvailable) return this.askToChoose(context);
      isOverCapacity = seat.isOverCapacity;
    }
    const write = {
      ...SYSTEM_ACTOR,
      slotId: action.slotId,
      dietType: action.dietType,
      source: action.source,
      isOverCapacity,
    };
    if (!(await this.bookings.updateBooking(booking.id, booking.version, write, context.tx)))
      return;
    const base = {
      ...SYSTEM_EVENT,
      bookingId: booking.id,
      fromStatus: booking.status,
      toStatus: booking.status,
    };
    if (isSlotChange)
      await this.bookings.addEvent(
        { ...base, type: 'SLOT_CHANGED', payload: { from: booking.slot.id, to: action.slotId } },
        context.tx,
      );
    if (booking.dietType !== action.dietType)
      await this.bookings.addEvent(
        { ...base, type: 'DIET_CHANGED', payload: { from: booking.dietType, to: action.dietType } },
        context.tx,
      );
    context.stats.updated += 1;
  }

  /** BR-DEF-3: no SKIP date exception, so switching Default Booking on again brings it back. */
  private async cancel(context: MealContext): Promise<void> {
    const booking = context.meal.booking;
    if (!booking) return;
    const write = {
      ...SYSTEM_ACTOR,
      status: BookingStatus.CANCELLED,
      cancelledAt: context.now,
      isOverCapacity: false,
    };
    if (!(await this.bookings.updateBooking(booking.id, booking.version, write, context.tx)))
      return;
    await this.bookings.addEvent(
      {
        ...SYSTEM_EVENT,
        bookingId: booking.id,
        type: 'CANCELLED',
        fromStatus: BookingStatus.BOOKED,
        toStatus: BookingStatus.CANCELLED,
        payload: { cause: 'RECURRING_OFF' },
      },
      context.tx,
    );
    context.stats.cancelled += 1;
  }

  private async askToChoose(context: MealContext): Promise<void> {
    context.stats.askedToChoose += 1;
    await this.notify.notifyWithin(context.tx, {
      studentIds: [context.studentId],
      category: 'BOOKING',
      title: `Choose a ${context.meal.mealName.toLowerCase()} slot`,
      body: `Your usual ${context.meal.mealName.toLowerCase()} slot is full on ${formatDay(context.date)}. Open the app to pick another slot.`,
      dedupeKey: `default-slot-full:${context.date}:${context.meal.mealType}`,
    });
  }

  private async tellMoved(slotId: string, context: MealContext): Promise<void> {
    context.stats.movedToFallback += 1;
    const label = context.meal.slots.find((slot) => slot.id === slotId)?.label ?? 'another slot';
    await this.notify.notifyWithin(context.tx, {
      studentIds: [context.studentId],
      category: 'BOOKING',
      title: `${context.meal.mealName} booked in another slot`,
      body: `Your usual ${context.meal.mealName.toLowerCase()} slot was full on ${formatDay(context.date)}, so you are booked for ${label}. Your Default Booking is unchanged.`,
      dedupeKey: `default-slot-moved:${context.date}:${context.meal.mealType}`,
    });
  }
}

function formatDay(date: BusinessDate): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}
