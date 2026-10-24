import { Injectable } from '@nestjs/common';
import {
  type BookingSource,
  BookingStatus,
  type BusinessDate,
  type DietType,
  type MealType,
  toBusinessDate,
  toInstant,
} from '@ennel/shared';
import { Clock } from '../../../infrastructure/clock/clock';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';
import { isUniqueViolation } from '../../../infrastructure/database/unique-violation';
import { type MessPolicy } from '../../mess-config/domain/mess-policy';
import { GetMessPolicyService } from '../../mess-config/services/get-mess-policy.service';
import { isMealCoveredByLeave } from '../domain/leave-coverage';
import { bookingDeadlines, isDeadlinePassed } from '../domain/meal-card-rules';
import {
  type BookingRow,
  type BookingWrite,
  BookingsRepository,
  type SlotRow,
} from '../repositories/bookings.repository';
import { BookingDayService } from './booking-day.service';
import { bookingChanged, deadlinePassed, notAllowed, slotUnavailable } from './booking-errors';

/** Who is acting. Staff skip student deadlines but must give a reason (BR-DEAD-7, Admin §H). */
export type BookingActor = { type: 'STUDENT' } | { type: 'STAFF'; staffId: string; reason: string };

export interface BookCommand {
  studentId: string;
  date: BusinessDate;
  mealType: MealType;
  slotId: string;
  dietType: DietType;
}

export interface ChangeCommand {
  slotId?: string;
  dietType?: DietType;
  version: number;
}

export interface BookingOutcome {
  bookingId: string;
  studentId: string;
  date: BusinessDate;
  mealType: MealType;
}

/**
 * The booking writes behind Home, Slot Selection and staff overrides (ADR-0003): every change
 * writes the one-day date exception and the booking row, plus a booking event, in one
 * transaction. Seats are checked under the slot/date lock (ADR-0004).
 */
@Injectable()
export class BookingCommandsService {
  constructor(
    private readonly bookings: BookingsRepository,
    private readonly days: BookingDayService,
    private readonly policies: GetMessPolicyService,
    private readonly clock: Clock,
  ) {}

  async book(
    actor: BookingActor,
    command: BookCommand,
    tx: TransactionClient,
  ): Promise<BookingOutcome> {
    const { now, policy } = await this.context(command.date, actor);
    const slot = await this.requireSlot(command.slotId, command.mealType, tx);
    const existing = await this.assertBookable(actor, command, slot, now, tx);
    const isOverCapacity = await this.reserveSeat(slot.id, command.date, policy, tx);
    const key = { studentId: command.studentId, mealId: slot.mealId, date: command.date };
    const source = originFor(actor);
    await this.bookings.saveDateException(
      key,
      { action: 'BOOK', slotId: slot.id, dietType: command.dietType, origin: source },
      tx,
    );
    const write: BookingWrite = {
      ...actorFields(actor),
      slotId: slot.id,
      dietType: command.dietType,
      status: BookingStatus.BOOKED,
      source,
      isOverCapacity,
      cancelledAt: null,
    };
    const bookingId = await this.saveBooking(existing, key, write, tx);
    await this.bookings.addEvent(
      {
        ...eventActor(actor),
        bookingId,
        type: 'CREATED',
        fromStatus: existing?.status ?? null,
        toStatus: BookingStatus.BOOKED,
        payload: { slotId: slot.id, dietType: command.dietType },
      },
      tx,
    );
    return {
      bookingId,
      studentId: command.studentId,
      date: command.date,
      mealType: command.mealType,
    };
  }

  async change(
    actor: BookingActor,
    booking: BookingRow,
    command: ChangeCommand,
    tx: TransactionClient,
  ): Promise<BookingOutcome> {
    assertBooked(booking);
    const { now, policy } = await this.context(booking.mealDate, actor);
    const deadlines = bookingDeadlines(booking.mealDate, booking.slot.startMinute, policy);
    const newSlot =
      command.slotId && command.slotId !== booking.slot.id
        ? await this.prepareSlotChange(
            actor,
            booking,
            command.slotId,
            deadlines.changeSlotAt,
            now,
            tx,
          )
        : null;
    const isDietChange = command.dietType !== undefined && command.dietType !== booking.dietType;
    if (isDietChange && actor.type === 'STUDENT' && isDeadlinePassed(deadlines.changeDietAt, now)) {
      throw deadlinePassed('Meal type changes', deadlines.changeDietAt);
    }
    const slotId = newSlot?.slot.id ?? booking.slot.id;
    const dietType = command.dietType ?? booking.dietType;
    const key = { studentId: booking.studentId, mealId: booking.mealId, date: booking.mealDate };
    const source = originFor(actor);
    await this.bookings.saveDateException(
      key,
      { action: 'BOOK', slotId, dietType, origin: source },
      tx,
    );
    const write: Partial<BookingWrite> = { ...actorFields(actor), slotId, dietType, source };
    if (newSlot) write.isOverCapacity = newSlot.isOverCapacity;
    if (!(await this.bookings.updateBooking(booking.id, command.version, write, tx)))
      throw bookingChanged();
    await this.recordChanges(
      actor,
      booking,
      newSlot?.slot.id ?? null,
      isDietChange ? dietType : null,
      tx,
    );
    return outcomeOf(booking, await this.mealTypeOf(booking.slot.id, tx));
  }

  async cancel(
    actor: BookingActor,
    booking: BookingRow,
    tx: TransactionClient,
  ): Promise<BookingOutcome> {
    assertBooked(booking);
    const { now, policy } = await this.context(booking.mealDate, actor);
    const { cancelAt } = bookingDeadlines(booking.mealDate, booking.slot.startMinute, policy);
    if (actor.type === 'STUDENT' && isDeadlinePassed(cancelAt, now))
      throw deadlinePassed('Cancellation', cancelAt);
    const key = { studentId: booking.studentId, mealId: booking.mealId, date: booking.mealDate };
    // A SKIP exception keeps the nightly Default Booking job from re-creating it (ADR-0003).
    await this.bookings.saveDateException(
      key,
      { action: 'SKIP', slotId: null, dietType: null, origin: originFor(actor) },
      tx,
    );
    const write = {
      ...actorFields(actor),
      status: BookingStatus.CANCELLED,
      cancelledAt: now,
      isOverCapacity: false,
    };
    if (!(await this.bookings.updateBooking(booking.id, booking.version, write, tx)))
      throw bookingChanged();
    await this.bookings.addEvent(
      {
        ...eventActor(actor),
        bookingId: booking.id,
        type: 'CANCELLED',
        fromStatus: BookingStatus.BOOKED,
        toStatus: BookingStatus.CANCELLED,
      },
      tx,
    );
    return outcomeOf(booking, await this.mealTypeOf(booking.slot.id, tx));
  }

  private async context(
    date: BusinessDate,
    actor: BookingActor,
  ): Promise<{ now: Date; policy: MessPolicy }> {
    const now = this.clock.now();
    const policy = await this.policies.execute();
    // Staff may correct past or far-future dates; students stay within the booking period.
    if (actor.type === 'STUDENT')
      this.days.assertWithinHorizon(date, toBusinessDate(now), policy.bookingHorizonDays);
    return { now, policy };
  }

  private async requireSlot(
    slotId: string,
    mealType: MealType,
    tx: TransactionClient,
  ): Promise<SlotRow> {
    const slot = await this.bookings.findSlot(slotId, tx);
    if (!slot || slot.mealType !== mealType)
      throw slotUnavailable('This slot is not available for this meal.');
    if (!slot.isActive) throw slotUnavailable('This slot is no longer offered.');
    return slot;
  }

  /** Closure, leave, slot start and an existing booking (BR-BOOK-7, BR-DEAD-5). */
  private async assertBookable(
    actor: BookingActor,
    command: BookCommand,
    slot: SlotRow,
    now: Date,
    tx: TransactionClient,
  ): Promise<BookingRow | null> {
    const day = await this.bookings.loadStudentDay(command.studentId, command.date, tx);
    const meal = day.meals.find((candidate) => candidate.mealId === slot.mealId);
    if (meal?.closureTitle)
      throw notAllowed(`The mess is closed for this meal: ${meal.closureTitle}.`);
    if (day.leaves.some((leave) => isMealCoveredByLeave(leave, command.date, command.mealType))) {
      throw notAllowed('You are on leave for this meal.');
    }
    if (
      actor.type === 'STUDENT' &&
      isDeadlinePassed(toInstant(command.date, slot.startMinute), now)
    ) {
      throw slotUnavailable('This slot has already started.');
    }
    const existing = meal?.booking ?? null;
    if (existing && existing.status !== BookingStatus.CANCELLED) {
      throw notAllowed('This meal is already booked. Use Change Slot to pick another slot.');
    }
    return existing;
  }

  /** BR-CAP-4, ADR-0004/0005: the seat count is read under the slot/date lock. */
  private async reserveSeat(
    slotId: string,
    date: BusinessDate,
    policy: MessPolicy,
    tx: TransactionClient,
  ): Promise<boolean> {
    await this.bookings.lockSlot(slotId, date, tx);
    const [seats, capacity] = [
      await this.bookings.seatsInUse(slotId, date, tx),
      await this.bookings.officialCapacity(slotId, date, tx),
    ];
    if (seats < capacity) return false;
    if (!policy.allowOverCapacityBooking)
      throw slotUnavailable('This slot is full. Please choose another slot.');
    return true;
  }

  private async prepareSlotChange(
    actor: BookingActor,
    booking: BookingRow,
    slotId: string,
    changeSlotAt: Date,
    now: Date,
    tx: TransactionClient,
  ): Promise<{ slot: SlotRow; isOverCapacity: boolean }> {
    const isStudent = actor.type === 'STUDENT';
    if (isStudent && isDeadlinePassed(changeSlotAt, now))
      throw deadlinePassed('Slot changes', changeSlotAt);
    const slot = await this.requireSlot(slotId, await this.mealTypeOf(booking.slot.id, tx), tx);
    if (isStudent && isDeadlinePassed(toInstant(booking.mealDate, slot.startMinute), now)) {
      throw slotUnavailable('This slot has already started.');
    }
    const policy = await this.policies.execute();
    return { slot, isOverCapacity: await this.reserveSeat(slot.id, booking.mealDate, policy, tx) };
  }

  private async recordChanges(
    actor: BookingActor,
    booking: BookingRow,
    newSlotId: string | null,
    newDiet: DietType | null,
    tx: TransactionClient,
  ): Promise<void> {
    const base = {
      ...eventActor(actor),
      bookingId: booking.id,
      fromStatus: booking.status,
      toStatus: booking.status,
    };
    if (newSlotId)
      await this.bookings.addEvent(
        { ...base, type: 'SLOT_CHANGED', payload: { from: booking.slot.id, to: newSlotId } },
        tx,
      );
    if (newDiet)
      await this.bookings.addEvent(
        { ...base, type: 'DIET_CHANGED', payload: { from: booking.dietType, to: newDiet } },
        tx,
      );
  }

  private async saveBooking(
    existing: BookingRow | null,
    key: { studentId: string; mealId: string; date: BusinessDate },
    write: BookingWrite,
    tx: TransactionClient,
  ): Promise<string> {
    if (existing) {
      if (!(await this.bookings.updateBooking(existing.id, existing.version, write, tx)))
        throw bookingChanged();
      return existing.id;
    }
    try {
      return await this.bookings.createBooking(key, write, tx);
    } catch (error) {
      // Two devices booking the same meal at once: the unique index lets only one through.
      if (isUniqueViolation(error)) throw notAllowed('This meal is already booked.');
      throw error;
    }
  }

  private async mealTypeOf(slotId: string, tx: TransactionClient): Promise<MealType> {
    const slot = await this.bookings.findSlot(slotId, tx);
    if (!slot) throw slotUnavailable('This slot is no longer offered.');
    return slot.mealType;
  }
}

function assertBooked(booking: BookingRow): void {
  if (booking.status !== BookingStatus.BOOKED)
    throw notAllowed('Only a booked meal can be changed or cancelled.');
}

function originFor(actor: BookingActor): BookingSource {
  return actor.type === 'STAFF' ? 'ADMIN' : 'MANUAL';
}

function actorFields(
  actor: BookingActor,
): Pick<BookingWrite, 'lastActorType' | 'lastActorStaffId' | 'lastOverrideReason'> {
  return actor.type === 'STAFF'
    ? { lastActorType: 'STAFF', lastActorStaffId: actor.staffId, lastOverrideReason: actor.reason }
    : { lastActorType: 'STUDENT', lastActorStaffId: null, lastOverrideReason: null };
}

function eventActor(actor: BookingActor) {
  return actor.type === 'STAFF'
    ? { actorType: 'STAFF' as const, actorStaffId: actor.staffId, reason: actor.reason }
    : { actorType: 'STUDENT' as const, actorStaffId: null, reason: null };
}

function outcomeOf(booking: BookingRow, mealType: MealType): BookingOutcome {
  return { bookingId: booking.id, studentId: booking.studentId, date: booking.mealDate, mealType };
}
