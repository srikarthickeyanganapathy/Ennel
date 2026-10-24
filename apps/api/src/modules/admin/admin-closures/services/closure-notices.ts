import { type BusinessDate, type MealType } from '@ennel/shared';

export const MEAL_NAMES: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
};

/** `2026-10-25` → `Sun, 25 Oct` for notification text. */
export function formatDay(date: BusinessDate): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}
