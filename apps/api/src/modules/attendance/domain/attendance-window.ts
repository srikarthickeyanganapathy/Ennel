import { type BusinessDate, type MealType, toInstant } from '@ennel/shared';

export interface MealTiming {
  mealType: MealType;
  serviceStartMinute: number;
  serviceEndMinute: number;
  /** Minutes after service end during which attendance still counts (BR-NS-1, default 0). */
  attendanceGraceMinutes: number;
}

export interface AttendanceWindow {
  opensAt: Date;
  closesAt: Date;
}

export type WindowPhase = 'BEFORE' | 'OPEN' | 'CLOSED';

const MINUTE_MS = 60_000;

/** BR-NS-1: a meal's attendance window runs from service start to service end + grace. */
export function attendanceWindow(date: BusinessDate, meal: MealTiming): AttendanceWindow {
  const serviceEnd = toInstant(date, meal.serviceEndMinute);
  return {
    opensAt: toInstant(date, meal.serviceStartMinute),
    // Grace may run past midnight, so it is added to the instant, not the minute of day.
    closesAt: new Date(serviceEnd.getTime() + meal.attendanceGraceMinutes * MINUTE_MS),
  };
}

export function windowPhase(window: AttendanceWindow, now: Date): WindowPhase {
  if (now < window.opensAt) return 'BEFORE';
  return now < window.closesAt ? 'OPEN' : 'CLOSED';
}

/**
 * The meal the counter should open on (Admin §I "active meal window"): the open one, else the
 * next one today, else the last one of the day.
 */
export function activeMealType(
  meals: readonly MealTiming[],
  date: BusinessDate,
  now: Date,
): MealType | null {
  const ordered = [...meals].sort((a, b) => a.serviceStartMinute - b.serviceStartMinute);
  const phases = ordered.map((meal) => ({
    meal,
    phase: windowPhase(attendanceWindow(date, meal), now),
  }));
  const pick =
    phases.find((entry) => entry.phase === 'OPEN') ??
    phases.find((entry) => entry.phase === 'BEFORE') ??
    phases.at(-1);
  return pick?.meal.mealType ?? null;
}

export interface OutagePeriod {
  startedAt: Date;
  /** Null while outage mode is still on. */
  endedAt: Date | null;
}

/** BR-NS-7: whether outage mode was on at any time during the window. */
export function overlapsOutage(
  window: AttendanceWindow,
  outages: readonly OutagePeriod[],
): boolean {
  return outages.some(
    (outage) =>
      outage.startedAt < window.closesAt &&
      (outage.endedAt === null || outage.endedAt > window.opensAt),
  );
}
