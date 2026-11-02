import { describe, expect, it } from 'vitest';
import {
  averageResolutionHours,
  type BookingCount,
  cancellationBucket,
  capacityOn,
  noShowRatePct,
  periodStart,
  reportByMeal,
  reportCancellations,
  reportSeries,
  reportSlots,
  type SlotInfo,
  tallyOf,
  tallyTotal,
  wasteOf,
} from './report-summary';

const row = (overrides: Partial<BookingCount>): BookingCount => ({
  date: '2026-11-02',
  mealId: 'lunch',
  slotId: 'a',
  status: 'COMPLETED',
  isOverCapacity: false,
  count: 1,
  ...overrides,
});
const ROWS = [
  row({ count: 8 }),
  row({ status: 'NO_SHOW', count: 2 }),
  row({ status: 'CANCELLED', count: 1 }),
  row({ status: 'BOOKED', date: '2026-11-03', count: 4 }),
  row({ status: 'CANCELLED_BY_CLOSURE', count: 9 }),
  row({ status: 'PAUSED_LEAVE', count: 9 }),
];
const SLOT: SlotInfo = {
  slotId: 'a',
  mealId: 'lunch',
  mealType: 'LUNCH',
  label: '11:00 AM',
  startMinute: 660,
  defaultCapacity: 10,
  weekdayCapacities: [{ weekday: 1, capacity: 20 }],
  dateCapacities: [{ date: '2026-11-03', capacity: 30 }],
};

describe('report counts (Admin §O, ADR-0029)', () => {
  it('counts closures and leave nowhere, and defines rate and waste on finished meals', () => {
    const tally = tallyOf(ROWS);
    expect(tally).toEqual({ served: 8, cancelled: 1, noShows: 2, pending: 4 });
    expect(tallyTotal(tally)).toBe(15);
    expect(noShowRatePct(tally)).toBe(20);
    expect(wasteOf(tally)).toBe(2);
  });

  it('has no rate without finished meals, rather than a misleading 0%', () => {
    expect(noShowRatePct({ served: 0, noShows: 0 })).toBeNull();
  });

  it('splits by meal', () => {
    const [lunch, dinner] = reportByMeal(ROWS, [
      { id: 'lunch', mealType: 'LUNCH', mealName: 'Lunch' },
      { id: 'dinner', mealType: 'DINNER', mealName: 'Dinner' },
    ]);
    expect(lunch).toMatchObject({ served: 8, total: 15, noShowRatePct: 20 });
    expect(dinner).toMatchObject({ served: 0, total: 0, noShowRatePct: null });
  });
});

describe('periods (Admin §O daily, weekly, monthly)', () => {
  it('starts weeks on Monday and months on the 1st', () => {
    expect(periodStart('2026-11-08', 'week')).toBe('2026-11-02'); // A Sunday.
    expect(periodStart('2026-11-02', 'week')).toBe('2026-11-02');
    expect(periodStart('2026-11-08', 'month')).toBe('2026-11-01');
    expect(periodStart('2026-11-08', 'day')).toBe('2026-11-08');
  });

  it('adds rows up per period, oldest first', () => {
    const series = reportSeries(
      [
        row({ date: '2026-11-09', count: 3 }),
        row({ date: '2026-11-02' }),
        row({ date: '2026-11-08' }),
      ],
      'week',
    );
    expect(series.map((item) => [item.period, item.served])).toEqual([
      ['2026-11-02', 2],
      ['2026-11-09', 3],
    ]);
  });
});

describe('slot utilization (Admin §O, BR-CAP-1)', () => {
  it('uses a date override, then a weekday capacity, then the default', () => {
    expect(capacityOn(SLOT, '2026-11-03')).toBe(30);
    expect(capacityOn(SLOT, '2026-11-02')).toBe(20); // Monday.
    expect(capacityOn(SLOT, '2026-11-04')).toBe(10);
  });

  it('leaves closed days out of capacity and averages over open days', () => {
    const [slot] = reportSlots(
      [row({ count: 10 }), row({ status: 'NO_SHOW', count: 2 }), row({ isOverCapacity: true })],
      [SLOT],
      {
        from: '2026-11-02',
        to: '2026-11-04',
        closedMeals: new Set(['lunch#2026-11-03']),
        hideUtilization: false,
      },
    );
    // Open capacity is 20 + 10; seats are 10 + 2 + 1.
    expect(slot).toMatchObject({ utilizationPct: 43, averageServedPerDay: 6, overCapacityDays: 1 });
  });

  it('hides utilization for one hostel, whose seats cannot be set against the whole slot', () => {
    const [slot] = reportSlots([row({})], [SLOT], {
      from: '2026-11-02',
      to: '2026-11-02',
      closedMeals: new Set(),
      hideUtilization: true,
    });
    expect(slot?.utilizationPct).toBeNull();
  });
});

describe('cancellation lead times and complaint resolution (Admin §O)', () => {
  it('buckets at the boundaries', () => {
    expect(cancellationBucket(59)).toBe('UNDER_1_HOUR');
    expect(cancellationBucket(60)).toBe('HOURS_1_TO_6');
    expect(cancellationBucket(360)).toBe('HOURS_6_TO_24');
    expect(cancellationBucket(1440)).toBe('OVER_24_HOURS');
  });

  it('measures to the slot start in IST, and treats after-the-start as no lead', () => {
    // 11:00 IST is 05:30 UTC.
    const report = reportCancellations([
      { date: '2026-11-02', startMinute: 660, cancelledAt: new Date('2026-11-02T03:30:00.000Z') },
      { date: '2026-11-02', startMinute: 660, cancelledAt: new Date('2026-11-02T06:00:00.000Z') },
    ]);
    expect(report.total).toBe(2);
    expect(report.averageLeadMinutes).toBe(60);
    expect(report.buckets.find((item) => item.bucket === 'UNDER_1_HOUR')?.count).toBe(1);
    expect(report.buckets.find((item) => item.bucket === 'HOURS_1_TO_6')?.count).toBe(1);
  });

  it('reports no average without data', () => {
    expect(reportCancellations([]).averageLeadMinutes).toBeNull();
    expect(averageResolutionHours([])).toBeNull();
    expect(
      averageResolutionHours([
        {
          createdAt: new Date('2026-11-02T00:00:00Z'),
          resolvedAt: new Date('2026-11-02T02:00:00Z'),
        },
        {
          createdAt: new Date('2026-11-02T00:00:00Z'),
          resolvedAt: new Date('2026-11-02T04:00:00Z'),
        },
      ]),
    ).toBe(3);
  });
});
