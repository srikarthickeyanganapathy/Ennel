import { type DietType, MealType, type MealPreferenceInput } from '@ennel/shared';

export interface MealSlotOptions {
  mealId: string;
  mealType: MealType;
  /** Active slots only, in serving order. */
  activeSlotIds: string[];
}

export interface ValidatedMealPreference {
  mealId: string;
  mealType: MealType;
  isEnabled: boolean;
  slotId: string | null;
  dietType: DietType;
}

export interface PreferenceIssue {
  mealType: MealType;
  message: string;
}

export type PreferenceValidation =
  { ok: true; preferences: ValidatedMealPreference[] } | { ok: false; issues: PreferenceIssue[] };

/**
 * Spec §3 Screen 7 / §8.2: an enabled meal needs a valid active slot for that meal.
 * Breakfast has one serving window (BR-MEAL-1), so its slot is filled in automatically.
 */
export function validateMealPreferences(
  inputs: MealPreferenceInput[],
  meals: MealSlotOptions[],
): PreferenceValidation {
  const issues: PreferenceIssue[] = [];
  const preferences: ValidatedMealPreference[] = [];
  for (const input of inputs) {
    const result = validateOne(input, meals);
    if ('message' in result) issues.push(result);
    else preferences.push(result);
  }
  return issues.length > 0 ? { ok: false, issues } : { ok: true, preferences };
}

function validateOne(
  input: MealPreferenceInput,
  meals: MealSlotOptions[],
): ValidatedMealPreference | PreferenceIssue {
  const meal = meals.find((candidate) => candidate.mealType === input.mealType);
  if (!meal) return { mealType: input.mealType, message: 'This meal is not offered' };

  const slotId = resolveSlotId(input, meal);
  if (slotId !== null && !meal.activeSlotIds.includes(slotId)) {
    return { mealType: input.mealType, message: 'Choose one of the available slots' };
  }
  if (input.isEnabled && slotId === null) {
    return { mealType: input.mealType, message: 'Choose a slot for this meal' };
  }
  return {
    mealId: meal.mealId,
    mealType: meal.mealType,
    isEnabled: input.isEnabled,
    slotId,
    dietType: input.dietType,
  };
}

function resolveSlotId(input: MealPreferenceInput, meal: MealSlotOptions): string | null {
  const [onlySlot] = meal.activeSlotIds;
  const isSingleWindow = meal.mealType === MealType.BREAKFAST && meal.activeSlotIds.length === 1;
  if (input.slotId === null && isSingleWindow && onlySlot) return onlySlot;
  return input.slotId;
}
