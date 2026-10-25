import { MEAL_TYPE_ORDER, type MealType } from '../enums/meal.js';
import { addBusinessDays, type BusinessDate } from '../time/business-time.js';

/** One meal on one date, e.g. Lunch on 2026-05-22. */
export interface MealPoint {
  date: BusinessDate;
  mealType: MealType;
}

/** A leave's inclusive range (BR-LEAVE-1). */
export interface MealRange {
  startDate: BusinessDate;
  startMealType: MealType;
  endDate: BusinessDate;
  endMealType: MealType;
}

const MEAL_INDEX: Record<MealType, number> = { BREAKFAST: 0, LUNCH: 1, DINNER: 2 };
const LAST_MEAL = MEAL_TYPE_ORDER.length - 1;
const MS_PER_DAY = 86_400_000;

export const rangeStart = (range: MealRange): MealPoint => ({
  date: range.startDate,
  mealType: range.startMealType,
});

export const rangeEnd = (range: MealRange): MealPoint => ({
  date: range.endDate,
  mealType: range.endMealType,
});

/** Negative when `a` is earlier, 0 when equal, positive when later (Breakfast → Dinner order). */
export function comparePoints(a: MealPoint, b: MealPoint): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return MEAL_INDEX[a.mealType] - MEAL_INDEX[b.mealType];
}

export function nextMeal(point: MealPoint): MealPoint {
  const index = MEAL_INDEX[point.mealType];
  if (index < LAST_MEAL)
    return { date: point.date, mealType: MEAL_TYPE_ORDER[index + 1] as MealType };
  return { date: addBusinessDays(point.date, 1), mealType: MEAL_TYPE_ORDER[0] as MealType };
}

export function previousMeal(point: MealPoint): MealPoint {
  const index = MEAL_INDEX[point.mealType];
  if (index > 0) return { date: point.date, mealType: MEAL_TYPE_ORDER[index - 1] as MealType };
  return {
    date: addBusinessDays(point.date, -1),
    mealType: MEAL_TYPE_ORDER[LAST_MEAL] as MealType,
  };
}

/** BR-LEAVE-2: the end may not come before the start. */
export function isRangeOrdered(range: MealRange): boolean {
  return comparePoints(rangeStart(range), rangeEnd(range)) <= 0;
}

export function isPointInRange(range: MealRange, point: MealPoint): boolean {
  return comparePoints(point, rangeStart(range)) >= 0 && comparePoints(point, rangeEnd(range)) <= 0;
}

/** BR-LEAVE-2: two leaves overlap when they share at least one meal. */
export function rangesOverlap(a: MealRange, b: MealRange): boolean {
  return (
    comparePoints(rangeStart(a), rangeEnd(b)) <= 0 && comparePoints(rangeStart(b), rangeEnd(a)) <= 0
  );
}

/**
 * BR-LEAVE-1 summary: calendar days touched and meals skipped, inclusive. Example: 22–31 May,
 * Breakfast → Dinner is 10 days and 30 meals.
 */
export function countRange(range: MealRange): { days: number; meals: number } {
  if (!isRangeOrdered(range)) return { days: 0, meals: 0 };
  const days =
    Math.round(
      (Date.parse(`${range.endDate}T00:00:00Z`) - Date.parse(`${range.startDate}T00:00:00Z`)) /
        MS_PER_DAY,
    ) + 1;
  const meals =
    days * MEAL_TYPE_ORDER.length -
    MEAL_INDEX[range.startMealType] -
    (LAST_MEAL - MEAL_INDEX[range.endMealType]);
  return { days, meals };
}
