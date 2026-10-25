import { describe, expect, it } from 'vitest';
import {
  checkLeaveRange,
  currentLeaveStatus,
  currentPoint,
  deriveLeaveState,
  earliestChangePoint,
  type MealOccurrence,
  type StoredLeave,
} from './leave-rules';

const at = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`);
const OCCURRENCES: MealOccurrence[] = [
  {
    point: { date: '2026-05-20', mealType: 'BREAKFAST' },
    cutoffAt: at('2026-05-20', '05:00'),
    serviceEndAt: at('2026-05-20', '08:30'),
  },
  {
    point: { date: '2026-05-20', mealType: 'LUNCH' },
    cutoffAt: at('2026-05-20', '10:00'),
    serviceEndAt: at('2026-05-20', '13:30'),
  },
  {
    point: { date: '2026-05-20', mealType: 'DINNER' },
    cutoffAt: at('2026-05-20', '17:00'),
    serviceEndAt: at('2026-05-20', '20:30'),
  },
  {
    point: { date: '2026-05-21', mealType: 'BREAKFAST' },
    cutoffAt: at('2026-05-21', '05:00'),
    serviceEndAt: at('2026-05-21', '08:30'),
  },
];
const leave = (
  id: string,
  status: StoredLeave['status'],
  start: string,
  end: string,
): StoredLeave => ({
  id,
  status,
  range: { startDate: start, startMealType: 'BREAKFAST', endDate: end, endMealType: 'DINNER' },
});

describe('earliest change and current point (ADR-0026, BR-LEAVE-7)', () => {
  it('picks the first meal whose cut-off is still open', () => {
    expect(earliestChangePoint(OCCURRENCES, at('2026-05-20', '09:00'))).toEqual({
      date: '2026-05-20',
      mealType: 'LUNCH',
    });
    expect(earliestChangePoint(OCCURRENCES, at('2026-05-20', '18:00'))).toEqual({
      date: '2026-05-21',
      mealType: 'BREAKFAST',
    });
  });

  it('treats the meal being served as current', () => {
    expect(currentPoint(OCCURRENCES, at('2026-05-20', '12:00'))).toEqual({
      date: '2026-05-20',
      mealType: 'LUNCH',
    });
  });
});

describe('derived leave state (BR-LEAVE-5)', () => {
  const now = { date: '2026-05-20', mealType: 'LUNCH' } as const;

  it('derives Upcoming, On Leave and Ended from the dates', () => {
    expect(deriveLeaveState(leave('a', 'APPROVED', '2026-05-22', '2026-05-31'), now)).toBe(
      'UPCOMING',
    );
    expect(deriveLeaveState(leave('b', 'APPROVED', '2026-05-19', '2026-05-20'), now)).toBe(
      'ON_LEAVE',
    );
    expect(deriveLeaveState(leave('c', 'APPROVED', '2026-05-10', '2026-05-19'), now)).toBe('ENDED');
    expect(deriveLeaveState(leave('d', 'PENDING', '2026-05-22', '2026-05-31'), now)).toBe(
      'PENDING',
    );
  });

  it('reports On Leave before Upcoming before Pending', () => {
    const leaves = [
      leave('p', 'PENDING', '2026-06-01', '2026-06-02'),
      leave('u', 'APPROVED', '2026-05-22', '2026-05-23'),
    ];
    expect(currentLeaveStatus(leaves, now)).toEqual({ status: 'UPCOMING', leaveId: 'u' });
    expect(currentLeaveStatus([], now)).toEqual({ status: 'NOT_ON_LEAVE', leaveId: null });
  });
});

describe('checkLeaveRange (BR-LEAVE-2, ADR-0026)', () => {
  const earliest = { date: '2026-05-20', mealType: 'LUNCH' } as const;
  const range = (startMealType: 'BREAKFAST' | 'LUNCH', endDate = '2026-05-22') => ({
    startDate: '2026-05-20',
    startMealType,
    endDate,
    endMealType: 'DINNER' as const,
  });

  it('accepts a valid range and refuses reversed, too-early and overlapping ones', () => {
    expect(checkLeaveRange(range('LUNCH'), earliest, [])).toBeNull();
    expect(checkLeaveRange(range('LUNCH', '2026-05-19'), earliest, [])?.message).toMatch(
      /on or after/,
    );
    expect(checkLeaveRange(range('BREAKFAST'), earliest, [])?.message).toMatch(
      /can still be cancelled/,
    );
    expect(
      checkLeaveRange(range('LUNCH'), earliest, [
        leave('x', 'APPROVED', '2026-05-22', '2026-05-25'),
      ])?.code,
    ).toBe('LEAVE_RANGE_INVALID');
    expect(
      checkLeaveRange(range('LUNCH'), earliest, [
        leave('x', 'REJECTED', '2026-05-22', '2026-05-25'),
      ]),
    ).toBeNull();
  });
});
