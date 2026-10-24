import { type ClosureKind, type MealType } from '@ennel/shared';

export const MEAL_NAMES: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
};

export const CLOSURE_KIND_LABELS: Record<ClosureKind, string> = {
  MESS_CLOSED: 'Mess closed',
  FESTIVAL: 'Festival / holiday',
  MAINTENANCE: 'Maintenance',
};

/** "1 booking" / "3 bookings" for toasts and the impact note. */
export const countOf = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;
