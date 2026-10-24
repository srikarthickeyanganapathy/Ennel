import { describe, expect, it } from 'vitest';
import { estimateShowUpRate, expectedPlates, type MealDayHistory } from './show-up-rate';

const day = (booked: number, attended: number, hasAttendanceData = true): MealDayHistory => ({
  booked,
  attended,
  hasAttendanceData,
});

describe('show-up rate and expected plates (BR-FC-1)', () => {
  it('uses 1.0 and flags low confidence without history', () => {
    expect(estimateShowUpRate([], 14)).toEqual({ rate: 1, daysUsed: 0, isLowConfidence: true });
    expect(expectedPlates(320, estimateShowUpRate([], 14))).toBe(320);
  });

  it('skips days without attendance data so a missing feed never reads as 0%', () => {
    const estimate = estimateShowUpRate([day(100, 0, false), day(100, 90)], 14);
    expect(estimate).toEqual({ rate: 0.9, daysUsed: 1, isLowConfidence: true });
  });

  it('averages the most recent lookback days and is confident from 7 days', () => {
    const history = [...Array.from({ length: 7 }, () => day(100, 80)), day(100, 10)];
    expect(estimateShowUpRate(history, 7)).toEqual({
      rate: 0.8,
      daysUsed: 7,
      isLowConfidence: false,
    });
    expect(expectedPlates(250, estimateShowUpRate(history, 7))).toBe(200);
  });

  it('rounds expected plates up', () => {
    expect(expectedPlates(10, { rate: 0.85, daysUsed: 7, isLowConfidence: false })).toBe(9);
  });
});
