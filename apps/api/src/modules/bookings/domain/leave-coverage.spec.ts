import { describe, expect, it } from 'vitest';
import { isMealCoveredByLeave } from './leave-coverage';

// Spec §11 example: 22–31 May, Breakfast → Dinner.
const LEAVE = {
  startDate: '2026-05-22',
  startMealType: 'LUNCH',
  endDate: '2026-05-31',
  endMealType: 'LUNCH',
} as const;

describe('isMealCoveredByLeave (BR-LEAVE-1)', () => {
  it('covers the inclusive meal range only', () => {
    expect(isMealCoveredByLeave(LEAVE, '2026-05-22', 'BREAKFAST')).toBe(false);
    expect(isMealCoveredByLeave(LEAVE, '2026-05-22', 'LUNCH')).toBe(true);
    expect(isMealCoveredByLeave(LEAVE, '2026-05-25', 'DINNER')).toBe(true);
    expect(isMealCoveredByLeave(LEAVE, '2026-05-31', 'LUNCH')).toBe(true);
    expect(isMealCoveredByLeave(LEAVE, '2026-05-31', 'DINNER')).toBe(false);
    expect(isMealCoveredByLeave(LEAVE, '2026-06-01', 'BREAKFAST')).toBe(false);
  });
});
