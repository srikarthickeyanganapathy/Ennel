import { type BusinessDate, type MealType } from '@ennel/shared';

const MEAL_ORDER: Record<MealType, number> = { BREAKFAST: 0, LUNCH: 1, DINNER: 2 };

export interface LeaveRange {
  startDate: BusinessDate;
  startMealType: MealType;
  endDate: BusinessDate;
  endMealType: MealType;
}

/**
 * BR-LEAVE-1: a leave covers the inclusive meal range (startDate, startMeal) … (endDate, endMeal)
 * in Breakfast → Lunch → Dinner order.
 */
export function isMealCoveredByLeave(
  leave: LeaveRange,
  date: BusinessDate,
  mealType: MealType,
): boolean {
  const meal = mealPosition(date, mealType);
  return (
    meal >= mealPosition(leave.startDate, leave.startMealType) &&
    meal <= mealPosition(leave.endDate, leave.endMealType)
  );
}

/** Sortable key: the date, then the meal's place in the day. */
function mealPosition(date: BusinessDate, mealType: MealType): string {
  return `${date}#${MEAL_ORDER[mealType]}`;
}
