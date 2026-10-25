import { type WeekdayRule } from '@ennel/shared';

/** Index = weekday number (0 = Sunday), matching the API (BR-TIME-1). */
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAY_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** Monday first, the way the week reads on a campus timetable. */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** "Mon, Wed, Fri" in Monday-first order, or "Every day". */
export function describeWeekdays(weekdays: readonly number[]): string {
  if (weekdays.length === 7) return 'Every day';
  return WEEKDAY_ORDER.filter((day) => weekdays.includes(day))
    .map((day) => WEEKDAY_SHORT[day])
    .join(', ');
}

/** Spec §6.2 rule summary, e.g. "Lunch on Mon, Wed · 1:00 PM - 1:30 PM · Non-Veg". */
export function describeRule(rule: WeekdayRule): string {
  const diet = rule.dietType === 'VEG' ? 'Veg' : 'Non-Veg';
  return `${rule.mealName} on ${describeWeekdays(rule.weekdays)} · ${rule.slotLabel} · ${diet}`;
}

/** ADR-0024 wording for a rule that is saved but not booking right now. */
export const PAUSED_TEXT: Record<NonNullable<WeekdayRule['pausedReason']>, string> = {
  DEFAULT_BOOKING_OFF: 'Paused while Default Booking is OFF.',
  AUTO_DISABLED: 'Paused after repeated No-shows for this meal.',
};
