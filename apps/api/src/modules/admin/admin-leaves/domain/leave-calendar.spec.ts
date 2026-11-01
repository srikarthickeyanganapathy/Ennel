import { describe, expect, it } from 'vitest';
import { dailyLeaveCounts, monthBounds } from './leave-calendar';

describe('leave calendar (Admin §K)', () => {
  it('knows month lengths, leap years included', () => {
    expect(monthBounds('2026-11')).toEqual({ first: '2026-11-01', last: '2026-11-30' });
    expect(monthBounds('2028-02')).toEqual({ first: '2028-02-01', last: '2028-02-29' });
  });

  it('counts each student once per day across overlapping leaves', () => {
    const counts = dailyLeaveCounts(
      [
        { studentId: 'a', startDate: '2026-10-30', endDate: '2026-11-02' },
        { studentId: 'a', startDate: '2026-11-02', endDate: '2026-11-03' },
        { studentId: 'b', startDate: '2026-11-02', endDate: '2026-11-02' },
      ],
      '2026-11-01',
      '2026-11-04',
    );
    expect(counts).toEqual([
      { date: '2026-11-01', count: 1 },
      { date: '2026-11-02', count: 2 },
      { date: '2026-11-03', count: 1 },
      { date: '2026-11-04', count: 0 },
    ]);
  });
});
