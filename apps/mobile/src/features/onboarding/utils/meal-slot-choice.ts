import { type MealConfig, MealType } from '@ennel/shared';
import { type MealDraft } from '../store/onboarding-draft.store';

/**
 * BR-ONB-4: only Breakfast's single serving window is filled in by the server. Every other
 * meal needs the student to pick a slot, even when the mess has left it with just one.
 */
export function isSlotAutoFilled(meal: MealConfig): boolean {
  return meal.mealType === MealType.BREAKFAST && meal.slots.length === 1;
}

/** Message for an enabled meal whose slot is missing or no longer offered, else null. */
export function slotChoiceError(meal: MealConfig, draft: MealDraft): string | null {
  if (!draft.isEnabled || isSlotAutoFilled(meal)) return null;
  if (meal.slots.length === 0) return 'No slots are open for this meal right now';
  const isOffered = meal.slots.some((slot) => slot.id === draft.slotId);
  return isOffered ? null : 'Choose a slot for this meal';
}
