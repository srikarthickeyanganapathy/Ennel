import { describe, expect, it } from 'vitest';
import {
  comparePoints,
  countRange,
  isPointInRange,
  isRangeOrdered,
  nextMeal,
  previousMeal,
  rangesOverlap,
} from './meal-range.js';

const MAY = {
  startDate: '2026-05-22',
  startMealType: 'BREAKFAST',
  endDate: '2026-05-31',
  endMealType: 'DINNER',
} as const;

describe('meal ranges (BR-LEAVE-1, BR-LEAVE-2)', () => {
  it('counts the spec example as 10 days and 30 meals', () => {
    expect(countRange(MAY)).toEqual({ days: 10, meals: 30 });
    expect(
      countRange({
        startDate: '2026-05-22',
        startMealType: 'DINNER',
        endDate: '2026-05-23',
        endMealType: 'LUNCH',
      }),
    ).toEqual({ days: 2, meals: 3 });
    expect(
      countRange({
        startDate: '2026-05-22',
        startMealType: 'LUNCH',
        endDate: '2026-05-22',
        endMealType: 'LUNCH',
      }),
    ).toEqual({ days: 1, meals: 1 });
  });

  it('orders meals within a day and across days', () => {
    expect(
      comparePoints(
        { date: '2026-05-22', mealType: 'DINNER' },
        { date: '2026-05-23', mealType: 'BREAKFAST' },
      ),
    ).toBeLessThan(0);
    expect(nextMeal({ date: '2026-05-31', mealType: 'DINNER' })).toEqual({
      date: '2026-06-01',
      mealType: 'BREAKFAST',
    });
    expect(previousMeal({ date: '2026-06-01', mealType: 'BREAKFAST' })).toEqual({
      date: '2026-05-31',
      mealType: 'DINNER',
    });
    expect(nextMeal({ date: '2026-05-31', mealType: 'BREAKFAST' })).toEqual({
      date: '2026-05-31',
      mealType: 'LUNCH',
    });
  });

  it('rejects an end before the start and detects shared meals', () => {
    expect(isRangeOrdered({ ...MAY, endDate: '2026-05-22', endMealType: 'BREAKFAST' })).toBe(true);
    expect(isRangeOrdered({ ...MAY, endDate: '2026-05-21' })).toBe(false);
    expect(rangesOverlap(MAY, { ...MAY, startDate: '2026-05-31', endDate: '2026-06-02' })).toBe(
      true,
    );
    expect(
      rangesOverlap(MAY, {
        startDate: '2026-06-01',
        startMealType: 'BREAKFAST',
        endDate: '2026-06-02',
        endMealType: 'DINNER',
      }),
    ).toBe(false);
    expect(isPointInRange(MAY, { date: '2026-05-31', mealType: 'DINNER' })).toBe(true);
    expect(isPointInRange(MAY, { date: '2026-06-01', mealType: 'BREAKFAST' })).toBe(false);
  });
});
