import {
  type ActorType,
  type BookingSource,
  BookingStatus,
  type BusinessDate,
  type DietType,
  toInstant,
} from '@ennel/shared';
import { bookingDeadlines, type DeadlinePolicy, isDeadlinePassed } from './meal-card-rules';
import { type Resolution } from './resolve-effective-booking';

/** Sources the recurring intent owns; one-day changes (MANUAL, PLAN_AHEAD_DATE, ADMIN) are left alone. */
const RECURRING_SOURCES: ReadonlySet<BookingSource> = new Set(['DEFAULT', 'PLAN_AHEAD_WEEKDAY']);

export interface ExistingBooking {
  status: BookingStatus;
  source: BookingSource;
  slotId: string;
  slotStartMinute: number;
  dietType: DietType;
  lastActorType: ActorType;
}

export interface ReconcileInput {
  date: BusinessDate;
  now: Date;
  existing: ExistingBooking | null;
  resolution: Resolution;
  /** Start of each active slot of the meal, by slot id. */
  slotStarts: ReadonlyMap<string, number>;
  policy: DeadlinePolicy;
}

export type ReconcileAction =
  | { kind: 'NONE' }
  | {
      kind: 'CREATE' | 'REACTIVATE' | 'UPDATE';
      slotId: string;
      dietType: DietType;
      source: BookingSource;
    }
  | { kind: 'CANCEL' };

const NONE: ReconcileAction = { kind: 'NONE' };

/**
 * What the recurring intent (Default Booking, weekday rules) means for one materialized booking
 * (BR-DEF-1, BR-DEF-3, ADR-0003). It only touches bookings the recurring intent owns, and never
 * acts after a deadline: nothing is created for a started slot, cancelled after the cancellation
 * deadline, or moved after the slot-change deadline.
 */
export function planReconciliation(input: ReconcileInput): ReconcileAction {
  const { existing, resolution } = input;
  if (existing && !isRecurringOwned(existing)) return NONE;
  if (resolution.kind === 'BOOK' && RECURRING_SOURCES.has(resolution.source)) {
    return planBooking(input, resolution);
  }
  // Closures and leave have their own use cases; only "no booking wanted" cancels here.
  if (resolution.kind !== 'NONE' || existing?.status !== BookingStatus.BOOKED) return NONE;
  const { cancelAt } = bookingDeadlines(input.date, existing.slotStartMinute, input.policy);
  return isDeadlinePassed(cancelAt, input.now) ? NONE : { kind: 'CANCEL' };
}

/**
 * A recurring booking, or one the system cancelled when Default Booking was switched off
 * (no SKIP date exception, so switching it on again brings it back).
 */
export function isRecurringOwned(existing: ExistingBooking): boolean {
  if (!RECURRING_SOURCES.has(existing.source)) return false;
  if (existing.status === BookingStatus.BOOKED) return true;
  return existing.status === BookingStatus.CANCELLED && existing.lastActorType === 'SYSTEM';
}

function planBooking(
  input: ReconcileInput,
  target: Extract<Resolution, { kind: 'BOOK' }>,
): ReconcileAction {
  const targetStart = input.slotStarts.get(target.slotId);
  if (targetStart === undefined) return NONE; // the preferred slot is no longer offered
  const hasStarted = isDeadlinePassed(toInstant(input.date, targetStart), input.now);
  const plan = { slotId: target.slotId, dietType: target.dietType, source: target.source };
  const { existing } = input;
  if (!existing) return hasStarted ? NONE : { kind: 'CREATE', ...plan };
  if (existing.status !== BookingStatus.BOOKED)
    return hasStarted ? NONE : { kind: 'REACTIVATE', ...plan };
  return planUpdate(input, existing, plan, hasStarted);
}

function planUpdate(
  input: ReconcileInput,
  existing: ExistingBooking,
  plan: { slotId: string; dietType: DietType; source: BookingSource },
  hasTargetStarted: boolean,
): ReconcileAction {
  const isSlotChange = existing.slotId !== plan.slotId;
  const isDietChange = existing.dietType !== plan.dietType;
  if (!isSlotChange && !isDietChange && existing.source === plan.source) return NONE;
  const deadlines = bookingDeadlines(input.date, existing.slotStartMinute, input.policy);
  if (isSlotChange && (hasTargetStarted || isDeadlinePassed(deadlines.changeSlotAt, input.now)))
    return NONE;
  if (isDietChange && isDeadlinePassed(deadlines.changeDietAt, input.now)) return NONE;
  return { kind: 'UPDATE', ...plan };
}
