import { describe, expect, it } from 'vitest';
import { mealDefaultStates } from './meal-default-state';

describe('mealDefaultStates (Spec §8, BR-NS-5)', () => {
  it('books a meal only when the overall switch and its own switch are on', () => {
    expect(
      mealDefaultStates(true, [
        { mealType: 'BREAKFAST', isEnabled: false, isAutoDisabled: false },
        { mealType: 'LUNCH', isEnabled: true, isAutoDisabled: false },
      ]),
    ).toEqual({ BREAKFAST: 'OFF', LUNCH: 'ON', DINNER: 'OFF' });
    expect(
      mealDefaultStates(false, [{ mealType: 'LUNCH', isEnabled: true, isAutoDisabled: false }]),
    ).toEqual({ BREAKFAST: 'OFF', LUNCH: 'OFF', DINNER: 'OFF' });
  });

  it('shows a No-show auto-disable even when the switches are on', () => {
    expect(
      mealDefaultStates(true, [{ mealType: 'DINNER', isEnabled: true, isAutoDisabled: true }]),
    ).toMatchObject({ DINNER: 'AUTO_OFF' });
  });
});
