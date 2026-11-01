import { MEAL_TYPE_ORDER, type MealType } from '@ennel/shared';

export type MealDefaultState = 'ON' | 'OFF' | 'AUTO_OFF';

export interface MealPreferenceFlags {
  mealType: MealType;
  isEnabled: boolean;
  isAutoDisabled: boolean;
}

/**
 * What Default Booking does for each meal, as the Students list shows it (Spec §8, BR-NS-5).
 * A No-show auto-disable wins, because it holds even when the student's own switches are on;
 * otherwise a meal books only when both the overall switch and the meal's switch are on.
 */
export function mealDefaultStates(
  isOverallOn: boolean,
  preferences: readonly MealPreferenceFlags[],
): Record<MealType, MealDefaultState> {
  const byMeal = new Map(preferences.map((preference) => [preference.mealType, preference]));
  const entries = MEAL_TYPE_ORDER.map((mealType): [MealType, MealDefaultState] => {
    const preference = byMeal.get(mealType);
    if (preference?.isAutoDisabled) return [mealType, 'AUTO_OFF'];
    return [mealType, isOverallOn && preference?.isEnabled ? 'ON' : 'OFF'];
  });
  return Object.fromEntries(entries) as Record<MealType, MealDefaultState>;
}
