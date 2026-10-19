/** Breakfast / Lunch / Dinner. Rule 1; Spec §2. */
export const MealType = {
  BREAKFAST: 'BREAKFAST',
  LUNCH: 'LUNCH',
  DINNER: 'DINNER',
} as const;
export type MealType = (typeof MealType)[keyof typeof MealType];

/** Serving order used for leave meal-range expansion (BR-LEAVE-1). */
export const MEAL_TYPE_ORDER: readonly MealType[] = [
  MealType.BREAKFAST,
  MealType.LUNCH,
  MealType.DINNER,
];

/**
 * Veg / Non-Veg. The spec calls this "meal type"; code uses DietType so that
 * MealType keeps one meaning (ADR-0012).
 */
export const DietType = {
  VEG: 'VEG',
  NON_VEG: 'NON_VEG',
} as const;
export type DietType = (typeof DietType)[keyof typeof DietType];
