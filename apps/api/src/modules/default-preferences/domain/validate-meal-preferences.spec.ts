import { type MealPreferenceInput } from '@ennel/shared';
import { describe, expect, it } from 'vitest';
import { type MealSlotOptions, validateMealPreferences } from './validate-meal-preferences';

const MEALS: MealSlotOptions[] = [
  { mealId: 'm-b', mealType: 'BREAKFAST', activeSlotIds: ['b1'] },
  { mealId: 'm-l', mealType: 'LUNCH', activeSlotIds: ['l1', 'l2', 'l3', 'l4', 'l5'] },
  { mealId: 'm-d', mealType: 'DINNER', activeSlotIds: ['d1', 'd2'] },
];

function preference(overrides: Partial<MealPreferenceInput>): MealPreferenceInput {
  return { mealType: 'LUNCH', isEnabled: true, slotId: 'l3', dietType: 'VEG', ...overrides };
}

describe('validateMealPreferences (Spec §3 Screen 7)', () => {
  it('accepts Example A: Breakfast off, Lunch and Dinner on with slots', () => {
    const result = validateMealPreferences(
      [
        preference({ mealType: 'BREAKFAST', isEnabled: false, slotId: null }),
        preference({ mealType: 'LUNCH', slotId: 'l3' }),
        preference({ mealType: 'DINNER', slotId: 'd2', dietType: 'NON_VEG' }),
      ],
      MEALS,
    );
    expect(result.ok).toBe(true);
  });

  it('fills the single Breakfast window automatically', () => {
    const result = validateMealPreferences(
      [preference({ mealType: 'BREAKFAST', slotId: null })],
      MEALS,
    );
    expect(result).toMatchObject({ ok: true, preferences: [{ mealId: 'm-b', slotId: 'b1' }] });
  });

  it('requires a slot when Lunch is enabled', () => {
    const result = validateMealPreferences([preference({ slotId: null })], MEALS);
    expect(result).toEqual({
      ok: false,
      issues: [{ mealType: 'LUNCH', message: 'Choose a slot for this meal' }],
    });
  });

  it('allows a disabled meal without a slot', () => {
    expect(
      validateMealPreferences([preference({ isEnabled: false, slotId: null })], MEALS).ok,
    ).toBe(true);
  });

  it('rejects a slot that belongs to another meal or is inactive', () => {
    const result = validateMealPreferences([preference({ slotId: 'd1' })], MEALS);
    expect(result.ok).toBe(false);
  });

  it("keeps a disabled meal's saved slot (Spec §8.1: preferences are preserved)", () => {
    const result = validateMealPreferences([preference({ isEnabled: false, slotId: 'l2' })], MEALS);
    expect(result).toMatchObject({ ok: true, preferences: [{ isEnabled: false, slotId: 'l2' }] });
  });
});
