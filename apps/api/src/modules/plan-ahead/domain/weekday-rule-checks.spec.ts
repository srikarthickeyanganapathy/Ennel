import { describe, expect, it } from 'vitest';
import { describeDays, findOverlappingDays, rulePausedReason } from './weekday-rule-checks';

const RULES = [
  { id: 'a', mealType: 'LUNCH' as const, weekdays: [1, 3, 5] },
  { id: 'b', mealType: 'DINNER' as const, weekdays: [0, 6] },
];

describe('findOverlappingDays (ADR-0014)', () => {
  it('reports days already covered by another rule for the same meal', () => {
    expect(findOverlappingDays(RULES, { mealType: 'LUNCH', weekdays: [5, 3, 2] })).toEqual([3, 5]);
  });

  it('ignores other meals and the rule being edited', () => {
    expect(findOverlappingDays(RULES, { mealType: 'BREAKFAST', weekdays: [1, 3] })).toEqual([]);
    expect(
      findOverlappingDays(RULES, { mealType: 'LUNCH', weekdays: [1], excludeId: 'a' }),
    ).toEqual([]);
  });
});

describe('describeDays', () => {
  it('lists day names in readable English', () => {
    expect(describeDays([1])).toBe('Monday');
    expect(describeDays([1, 3])).toBe('Monday and Wednesday');
    expect(describeDays([0, 1, 3])).toBe('Sunday, Monday and Wednesday');
  });
});

describe('rulePausedReason (ADR-0024)', () => {
  it('pauses rules with the overall switch first, then a no-show auto-disable', () => {
    expect(rulePausedReason({ isOverallEnabled: false, isAutoDisabled: true })).toBe(
      'DEFAULT_BOOKING_OFF',
    );
    expect(rulePausedReason({ isOverallEnabled: true, isAutoDisabled: true })).toBe(
      'AUTO_DISABLED',
    );
    expect(rulePausedReason({ isOverallEnabled: true, isAutoDisabled: false })).toBeNull();
  });
});
