import {
  type BookingLabel,
  BookingSource,
  BookingStatus,
  type BusinessDate,
  type DietType,
  formatMinuteOfDay,
  type MealAction,
  toInstant,
  toMinuteOfDay,
} from '@ennel/shared';
import { type Resolution } from './resolve-effective-booking';

export interface DeadlinePolicy {
  cancellationCutoffMinutes: number;
  dietTypeChangeCutoffMinutes: number;
}

export interface BookingDeadlines {
  cancelAt: Date;
  changeSlotAt: Date;
  changeDietAt: Date;
}

/** BR-DEAD-1..3, ADR-0010, ADR-0012: all deadlines hang off the booked slot's start. */
export function bookingDeadlines(
  date: BusinessDate,
  slotStartMinute: number,
  policy: DeadlinePolicy,
): BookingDeadlines {
  const start = toInstant(date, slotStartMinute);
  return {
    cancelAt: minutesBefore(start, policy.cancellationCutoffMinutes),
    changeSlotAt: start,
    changeDietAt: minutesBefore(start, policy.dietTypeChangeCutoffMinutes),
  };
}

/** BR-DEAD-4: at exactly the deadline the action is already closed. */
export function isDeadlinePassed(deadline: Date, now: Date): boolean {
  return now.getTime() >= deadline.getTime();
}

function minutesBefore(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() - minutes * 60_000);
}

export interface CardBookingState {
  status: BookingStatus;
  source: BookingSource;
  slotId: string;
  dietType: DietType;
  /** True when the system cancelled a recurring booking because Default Booking was switched off. */
  isSystemCancelled?: boolean;
}

export interface LabelInput {
  booking: CardBookingState | null;
  /** The full resolution, for meals with no booking row (closure, leave). */
  resolution: Resolution;
  /** What recurring intent alone would give (weekday rule, then Default Booking). */
  recurring: Resolution;
  isDefaultOff: boolean;
}

/** BR-BOOK-3 status label, derived and never stored (Spec §4.3). */
export function deriveBookingLabel(input: LabelInput): BookingLabel {
  const { booking } = input;
  if (!booking) return labelWithoutBooking(input);
  switch (booking.status) {
    case BookingStatus.BOOKED:
      return labelForBooked(booking, input.recurring);
    case BookingStatus.CANCELLED:
      // Switched off by the student's own settings, not cancelled for the day (BR-DEF-3).
      return booking.isSystemCancelled ? labelWithoutBooking(input) : 'CANCELLED';
    case BookingStatus.PAUSED_LEAVE:
      return 'PAUSED_LEAVE';
    case BookingStatus.CANCELLED_BY_CLOSURE:
      return 'MESS_CLOSED';
    case BookingStatus.NO_SHOW:
      return 'NO_SHOW';
    case BookingStatus.COMPLETED:
      return 'COMPLETED';
  }
}

function labelWithoutBooking({ resolution, isDefaultOff }: LabelInput): BookingLabel {
  if (resolution.kind === 'CLOSED') return 'MESS_CLOSED';
  if (resolution.kind === 'PAUSED_LEAVE') return 'PAUSED_LEAVE';
  return isDefaultOff ? 'NOT_BOOKED_DEFAULT_OFF' : 'NOT_BOOKED';
}

function labelForBooked(booking: CardBookingState, recurring: Resolution): BookingLabel {
  if (booking.source === BookingSource.DEFAULT) return 'BOOKED_DEFAULT';
  if (booking.source === BookingSource.PLAN_AHEAD_WEEKDAY) return 'BOOKED_WEEKDAY_RULE';
  if (recurring.kind !== 'BOOK') return 'BOOKED_ONCE';
  const isSameAsRecurring =
    recurring.slotId === booking.slotId && recurring.dietType === booking.dietType;
  if (!isSameAsRecurring) return 'CHANGED_FOR_THIS_DAY';
  return recurring.source === BookingSource.DEFAULT ? 'BOOKED_DEFAULT' : 'BOOKED_WEEKDAY_RULE';
}

export interface ActionContext {
  now: Date;
  date: BusinessDate;
  isClosed: boolean;
  isOnLeave: boolean;
  isWithinHorizon: boolean;
  /** Start of the meal's last active slot; null when the meal has no slots. */
  lastSlotStartMinute: number | null;
  booking: { status: BookingStatus; slotStartMinute: number } | null;
  policy: DeadlinePolicy;
}

export interface MealActions {
  book: MealAction;
  changeSlot: MealAction;
  changeDiet: MealAction;
  cancel: MealAction;
}

const NOT_APPLICABLE: MealAction = { allowed: false, reason: null, deadlineAt: null };

/** Which card buttons work right now and why not (Spec §4.3–4.5, §14, BR-DEAD). */
export function mealActions(context: ActionContext): MealActions {
  const isBooked = context.booking?.status === BookingStatus.BOOKED;
  return {
    book: isBooked || isFinal(context.booking?.status) ? NOT_APPLICABLE : bookAction(context),
    ...(isBooked && context.booking
      ? bookedActions(context, context.booking.slotStartMinute)
      : notBooked()),
  };
}

/** Attendance outcomes and closures are not changed by students. */
function isFinal(status: BookingStatus | undefined): boolean {
  return (
    status === BookingStatus.COMPLETED ||
    status === BookingStatus.NO_SHOW ||
    status === BookingStatus.PAUSED_LEAVE ||
    status === BookingStatus.CANCELLED_BY_CLOSURE
  );
}

function notBooked(): Omit<MealActions, 'book'> {
  return { changeSlot: NOT_APPLICABLE, changeDiet: NOT_APPLICABLE, cancel: NOT_APPLICABLE };
}

function bookAction(context: ActionContext): MealAction {
  if (context.isClosed) return refused('The mess is closed for this meal.');
  if (context.isOnLeave) return refused('You are on leave for this meal.');
  if (!context.isWithinHorizon) return refused('This date is outside the booking period.');
  if (context.lastSlotStartMinute === null) return refused('No slots are open for this meal.');
  // BR-DEAD-5: a new booking for today is possible until the last slot starts.
  const lastStart = toInstant(context.date, context.lastSlotStartMinute);
  if (isDeadlinePassed(lastStart, context.now))
    return refused('All slots for this meal have started.');
  return { allowed: true, reason: null, deadlineAt: lastStart.toISOString() };
}

function bookedActions(context: ActionContext, slotStartMinute: number): Omit<MealActions, 'book'> {
  const deadlines = bookingDeadlines(context.date, slotStartMinute, context.policy);
  return {
    changeSlot: byDeadline(deadlines.changeSlotAt, context.now, 'Slot changes closed at'),
    changeDiet: byDeadline(deadlines.changeDietAt, context.now, 'Meal type changes closed at'),
    cancel: byDeadline(deadlines.cancelAt, context.now, 'Cancellation closed at'),
  };
}

function byDeadline(deadline: Date, now: Date, closedText: string): MealAction {
  const deadlineAt = deadline.toISOString();
  if (!isDeadlinePassed(deadline, now)) return { allowed: true, reason: null, deadlineAt };
  return {
    allowed: false,
    reason: `${closedText} ${formatMinuteOfDay(toMinuteOfDay(deadline))}.`,
    deadlineAt,
  };
}

function refused(reason: string): MealAction {
  return { allowed: false, reason, deadlineAt: null };
}
