import { type AppliedRule, BookingSource, type DietType } from '@ennel/shared';

export interface DateExceptionIntent {
  action: 'BOOK' | 'SKIP';
  slotId: string | null;
  dietType: DietType | null;
  /** MANUAL | PLAN_AHEAD_DATE | ADMIN */
  origin: BookingSource;
}

export interface SlotChoice {
  slotId: string;
  dietType: DietType;
}

export interface DefaultIntent extends Partial<SlotChoice> {
  /** The student's overall Default Booking switch (Spec §8.1). */
  isOverallEnabled: boolean;
  isMealEnabled: boolean;
  /** Set by the no-show engine (BR-NS-5). */
  isAutoDisabled: boolean;
}

export interface ResolutionInput {
  isClosed: boolean;
  isOnApprovedLeave: boolean;
  dateException: DateExceptionIntent | null;
  /** The active weekday rule covering this date's weekday, if any. */
  weekdayRule: SlotChoice | null;
  defaultIntent: DefaultIntent | null;
}

export type Resolution =
  | { kind: 'CLOSED'; appliedRule: 'CLOSURE' }
  | { kind: 'PAUSED_LEAVE'; appliedRule: 'LEAVE' }
  | { kind: 'NONE'; appliedRule: Extract<AppliedRule, 'DATE_EXCEPTION' | 'NONE'> }
  | ({ kind: 'BOOK'; source: BookingSource; appliedRule: AppliedRule } & SlotChoice);

/**
 * What a student's meal on one date resolves to (Rule 4, BR-BOOK-4, ADR-0003, ADR-0014):
 * closure > approved leave > one-day date exception > weekday rule > Default Booking.
 */
export function resolveEffectiveBooking(input: ResolutionInput): Resolution {
  if (input.isClosed) return { kind: 'CLOSED', appliedRule: 'CLOSURE' };
  if (input.isOnApprovedLeave) return { kind: 'PAUSED_LEAVE', appliedRule: 'LEAVE' };
  if (input.dateException) return fromDateException(input.dateException);
  return resolveRecurring(input.weekdayRule, input.defaultIntent);
}

/** The recurring intent alone, used to tell "Booked Once" from "Changed for This Day". */
export function resolveRecurring(
  weekdayRule: SlotChoice | null,
  defaultIntent: DefaultIntent | null,
): Resolution {
  if (weekdayRule) {
    return {
      kind: 'BOOK',
      source: BookingSource.PLAN_AHEAD_WEEKDAY,
      appliedRule: 'WEEKDAY_RULE',
      ...weekdayRule,
    };
  }
  const choice = defaultIntent && defaultChoice(defaultIntent);
  if (choice)
    return { kind: 'BOOK', source: BookingSource.DEFAULT, appliedRule: 'DEFAULT', ...choice };
  return { kind: 'NONE', appliedRule: 'NONE' };
}

function fromDateException(exception: DateExceptionIntent): Resolution {
  if (exception.action === 'SKIP' || !exception.slotId || !exception.dietType) {
    return { kind: 'NONE', appliedRule: 'DATE_EXCEPTION' };
  }
  return {
    kind: 'BOOK',
    source: exception.origin,
    appliedRule: 'DATE_EXCEPTION',
    slotId: exception.slotId,
    dietType: exception.dietType,
  };
}

/** BR-BOOK-6: Default Booking applies only with both switches on, no auto-disable and a slot. */
export function defaultChoice(intent: DefaultIntent): SlotChoice | null {
  const isOn = intent.isOverallEnabled && intent.isMealEnabled && !intent.isAutoDisabled;
  if (!isOn || !intent.slotId || !intent.dietType) return null;
  return { slotId: intent.slotId, dietType: intent.dietType };
}
