import { describe, expect, it } from 'vitest';
import { diffPreferences, type PreferenceState } from './preference-changes';

const LABELS = new Map([
  ['l1', '11:00 AM - 11:30 AM'],
  ['l3', '12:00 PM - 12:30 PM'],
]);
const BEFORE: PreferenceState = {
  defaultBookingEnabled: true,
  meals: {
    BREAKFAST: { isEnabled: true, slotId: 'b1', dietType: 'VEG' },
    LUNCH: { isEnabled: true, slotId: 'l1', dietType: 'VEG' },
  },
};

describe('diffPreferences (Spec §8.3 summary)', () => {
  it('lists each changed setting with readable values, in meal order', () => {
    const after: PreferenceState = {
      defaultBookingEnabled: true,
      meals: {
        BREAKFAST: { isEnabled: false, slotId: 'b1', dietType: 'VEG' },
        LUNCH: { isEnabled: true, slotId: 'l3', dietType: 'NON_VEG' },
      },
    };
    expect(diffPreferences(BEFORE, after, LABELS)).toEqual([
      { mealType: 'BREAKFAST', field: 'ENABLED', from: 'ON', to: 'OFF' },
      { mealType: 'LUNCH', field: 'SLOT', from: '11:00 AM - 11:30 AM', to: '12:00 PM - 12:30 PM' },
      { mealType: 'LUNCH', field: 'MEAL_TYPE', from: 'Veg', to: 'Non-Veg' },
    ]);
  });

  it('reports the overall switch and nothing when nothing changed', () => {
    expect(diffPreferences(BEFORE, { ...BEFORE, defaultBookingEnabled: false }, LABELS)).toEqual([
      { mealType: null, field: 'DEFAULT_BOOKING', from: 'ON', to: 'OFF' },
    ]);
    expect(diffPreferences(BEFORE, BEFORE, LABELS)).toEqual([]);
  });
});
