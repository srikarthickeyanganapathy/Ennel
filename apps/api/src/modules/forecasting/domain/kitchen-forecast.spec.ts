import { describe, expect, it } from 'vitest';
import { forecastMealDay, type ForecastMealInput, wastedPlates } from './kitchen-forecast';

const INPUT: ForecastMealInput = {
  date: '2026-11-10',
  mealType: 'LUNCH',
  mealName: 'Lunch',
  closureTitle: null,
  slots: [
    { slotId: 'a', label: '11:00', startMinute: 660 },
    { slotId: 'b', label: '13:00', startMinute: 780 },
  ],
  seats: [
    { slotId: 'a', dietType: 'VEG', count: 10 },
    { slotId: 'a', dietType: 'NON_VEG', count: 5 },
    { slotId: 'b', dietType: 'VEG', count: 3 },
  ],
  estimate: { rate: 0.9, daysUsed: 10, isLowConfidence: false },
  cancellationCutoffMinutes: 60,
  now: new Date('2026-11-09T00:00:00.000Z'),
};

describe('forecastMealDay (Admin §N, BR-FC-1, BR-RPT-1)', () => {
  it('rounds expected plates up per slot and diet, then adds them for the meal', () => {
    const day = forecastMealDay(INPUT);
    expect(day.slots[0]?.veg).toEqual({ booked: 10, expected: 9 });
    expect(day.slots[0]?.nonVeg).toEqual({ booked: 5, expected: 5 });
    expect(day.slots[1]?.veg).toEqual({ booked: 3, expected: 3 });
    expect(day.veg).toEqual({ booked: 13, expected: 12 });
    expect(day.nonVeg).toEqual({ booked: 5, expected: 5 });
    expect(day.showUpRatePct).toBe(90);
  });

  it('locks only when the last slot can no longer be cancelled', () => {
    // 13:00 IST is 07:30 UTC, so a 60-minute cutoff falls at 06:30 UTC.
    const at = (iso: string) => forecastMealDay({ ...INPUT, now: new Date(iso) }).isLocked;
    expect(at('2026-11-10T06:29:59.000Z')).toBe(false);
    expect(at('2026-11-10T06:30:00.000Z')).toBe(true);
  });

  it('carries the confidence flag and a closure', () => {
    const day = forecastMealDay({
      ...INPUT,
      closureTitle: 'Festival',
      estimate: { rate: 1, daysUsed: 0, isLowConfidence: true },
    });
    expect(day).toMatchObject({ closureTitle: 'Festival', isLowConfidence: true, daysUsed: 0 });
  });
});

describe('wastedPlates (ADR-0029)', () => {
  it('counts booked but not attended, and never goes negative', () => {
    expect(wastedPlates({ booked: 10, served: 7 })).toBe(3);
    expect(wastedPlates({ booked: 2, served: 5 })).toBe(0);
  });
});
