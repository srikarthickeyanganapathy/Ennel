import { type MealType, type WeekdayRule } from '@ennel/shared';

export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export interface RuleDays {
  id: string;
  mealType: MealType;
  weekdays: number[];
}

/**
 * ADR-0014: two active rules for the same meal may not share a weekday, so there is never a
 * tie to break. Returns the clashing weekdays (sorted), empty when the candidate fits.
 */
export function findOverlappingDays(
  existing: readonly RuleDays[],
  candidate: { mealType: MealType; weekdays: readonly number[]; excludeId?: string },
): number[] {
  const taken = new Set(
    existing
      .filter((rule) => rule.mealType === candidate.mealType && rule.id !== candidate.excludeId)
      .flatMap((rule) => rule.weekdays),
  );
  return [...new Set(candidate.weekdays)].filter((day) => taken.has(day)).sort((a, b) => a - b);
}

/** "Monday and Wednesday" / "Monday, Wednesday and Friday" for messages. */
export function describeDays(weekdays: readonly number[]): string {
  const names = weekdays.map((day) => WEEKDAY_NAMES[day] ?? String(day));
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** ADR-0024: why a saved rule is not booking right now, matching `isRecurringPaused`. */
export function rulePausedReason(state: {
  isOverallEnabled: boolean;
  isAutoDisabled: boolean;
}): WeekdayRule['pausedReason'] {
  if (!state.isOverallEnabled) return 'DEFAULT_BOOKING_OFF';
  if (state.isAutoDisabled) return 'AUTO_DISABLED';
  return null;
}
