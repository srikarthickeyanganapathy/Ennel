import { type DietType, type MealType, type PreferenceChange } from '@ennel/shared';

export interface MealSetting {
  isEnabled: boolean;
  slotId: string | null;
  dietType: DietType;
}

export interface PreferenceState {
  defaultBookingEnabled: boolean;
  meals: Partial<Record<MealType, MealSetting>>;
}

const MEAL_ORDER: MealType[] = ['BREAKFAST', 'LUNCH', 'DINNER'];
const DIET_TEXT: Record<DietType, string> = { VEG: 'Veg', NON_VEG: 'Non-Veg' };
const onOff = (value: boolean) => (value ? 'ON' : 'OFF');

/**
 * Spec §8.3 "show a summary of what changed": one entry per changed setting, in meal order,
 * with readable values (slot labels come from `slotLabels`).
 */
export function diffPreferences(
  before: PreferenceState,
  after: PreferenceState,
  slotLabels: ReadonlyMap<string, string>,
): PreferenceChange[] {
  const changes: PreferenceChange[] = [];
  if (before.defaultBookingEnabled !== after.defaultBookingEnabled) {
    changes.push({
      mealType: null,
      field: 'DEFAULT_BOOKING',
      from: onOff(before.defaultBookingEnabled),
      to: onOff(after.defaultBookingEnabled),
    });
  }
  for (const mealType of MEAL_ORDER) {
    const old = before.meals[mealType];
    const next = after.meals[mealType];
    if (!next) continue;
    const label = (slotId: string | null | undefined) =>
      slotId ? (slotLabels.get(slotId) ?? null) : null;
    if (old?.isEnabled !== next.isEnabled) {
      changes.push({
        mealType,
        field: 'ENABLED',
        from: old ? onOff(old.isEnabled) : null,
        to: onOff(next.isEnabled),
      });
    }
    if ((old?.slotId ?? null) !== next.slotId) {
      changes.push({ mealType, field: 'SLOT', from: label(old?.slotId), to: label(next.slotId) });
    }
    if (old?.dietType !== next.dietType) {
      changes.push({
        mealType,
        field: 'MEAL_TYPE',
        from: old ? DIET_TEXT[old.dietType] : null,
        to: DIET_TEXT[next.dietType],
      });
    }
  }
  return changes;
}
