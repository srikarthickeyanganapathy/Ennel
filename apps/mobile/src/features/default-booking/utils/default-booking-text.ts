import {
  type DefaultMealSettings,
  type DefaultPreferences,
  type MealPreferenceInput,
  type PreferenceChange,
  SlotFullFallback,
} from '@ennel/shared';

const MEAL_NAMES = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', DINNER: 'Dinner' } as const;
const FIELD_NAMES = {
  ENABLED: 'automatic booking',
  SLOT: 'slot',
  MEAL_TYPE: 'meal type',
} as const;

/** Spec §8.3 "summary of what changed": one readable line per change. */
export function describeChange(change: PreferenceChange): string {
  const to = change.to ?? 'none';
  if (change.field === 'DEFAULT_BOOKING' || change.mealType === null) {
    return `Default Booking turned ${to}`;
  }
  const subject = `${MEAL_NAMES[change.mealType]} ${FIELD_NAMES[change.field]}`;
  return change.from ? `${subject}: ${change.from} → ${to}` : `${subject}: ${to}`;
}

/** The confirmation shown after a save, including how many upcoming bookings were updated. */
export function describeSaveResult(changes: PreferenceChange[], bookingsUpdated: number): string {
  if (changes.length === 0) return 'Nothing changed.';
  const lines = changes.map(describeChange);
  if (bookingsUpdated > 0) {
    lines.push(
      `${bookingsUpdated} upcoming ${bookingsUpdated === 1 ? 'booking was' : 'bookings were'} updated to match.`,
    );
  }
  return lines.join('\n');
}

/** Spec §8.4: the full-slot rule is stated, never left implicit (ADR-0006). */
export const FALLBACK_TEXT: Record<SlotFullFallback, string> = {
  [SlotFullFallback.AUTO_NEXT_AVAILABLE]:
    'If your usual slot is full, the app books the next slot with seats and tells you which one.',
  [SlotFullFallback.ASK_STUDENT]:
    'If your usual slot is full, the meal is not booked automatically. You get a notification to pick another slot.',
};

export const HOW_IT_WORKS_TEXT =
  'Each night the app books the next days for every meal that is ON, using its slot and meal type. ' +
  'To change just one day, use Home or Plan Ahead; that does not change these settings. ' +
  'Turning Default Booking OFF pauses all meals and keeps your choices.';

/** The PUT body from the current settings, with the given changes applied. */
export function toSaveRequest(
  preferences: DefaultPreferences,
  overrides: { defaultBookingEnabled?: boolean; meals?: MealPreferenceInput[] } = {},
) {
  return {
    defaultBookingEnabled: overrides.defaultBookingEnabled ?? preferences.defaultBookingEnabled,
    meals: overrides.meals ?? preferences.meals.map(toMealInput),
  };
}

export function toMealInput(meal: DefaultMealSettings): MealPreferenceInput {
  return {
    mealType: meal.mealType,
    isEnabled: meal.isEnabled,
    slotId: meal.slotId,
    dietType: meal.dietType,
  };
}

/** Breakfast's single serving window needs no choice (BR-ONB-4); every other meal does. */
export function needsSlotChoice(meal: DefaultMealSettings): boolean {
  return !(meal.mealType === 'BREAKFAST' && meal.slots.length === 1);
}

/** Message for an enabled meal whose slot is missing or no longer offered, else null. */
export function slotProblem(meal: DefaultMealSettings, draft: MealPreferenceInput): string | null {
  if (!draft.isEnabled || !needsSlotChoice(meal)) return null;
  if (meal.slots.length === 0) return 'No slots are open for this meal right now';
  return meal.slots.some((slot) => slot.slotId === draft.slotId)
    ? null
    : 'Choose a slot for this meal';
}
