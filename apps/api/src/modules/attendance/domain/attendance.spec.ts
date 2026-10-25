import { describe, expect, it } from 'vitest';
import { decideManualMark, planWindowClose } from './attendance-rules';
import {
  activeMealType,
  attendanceWindow,
  type MealTiming,
  overlapsOutage,
  windowPhase,
} from './attendance-window';

const DATE = '2026-10-26';
const LUNCH: MealTiming = {
  mealType: 'LUNCH',
  serviceStartMinute: 12 * 60,
  serviceEndMinute: 14 * 60,
  attendanceGraceMinutes: 15,
};
const DINNER: MealTiming = {
  mealType: 'DINNER',
  serviceStartMinute: 19 * 60,
  serviceEndMinute: 23 * 60 + 50,
  attendanceGraceMinutes: 20,
};
const at = (time: string) => new Date(`${DATE}T${time}:00+05:30`);

describe('attendance window (BR-NS-1)', () => {
  it('runs from service start to service end plus grace, even past midnight', () => {
    expect(attendanceWindow(DATE, LUNCH)).toEqual({ opensAt: at('12:00'), closesAt: at('14:15') });
    expect(attendanceWindow(DATE, DINNER).closesAt).toEqual(new Date('2026-10-27T00:10:00+05:30'));
  });

  it('reports the phase and picks the meal the counter should show', () => {
    const window = attendanceWindow(DATE, LUNCH);
    expect(windowPhase(window, at('11:59'))).toBe('BEFORE');
    expect(windowPhase(window, at('14:14'))).toBe('OPEN');
    expect(windowPhase(window, at('14:15'))).toBe('CLOSED');
    expect(activeMealType([DINNER, LUNCH], DATE, at('13:00'))).toBe('LUNCH');
    expect(activeMealType([DINNER, LUNCH], DATE, at('16:00'))).toBe('DINNER');
  });

  it('detects outage mode during any part of the window (BR-NS-7)', () => {
    const window = attendanceWindow(DATE, LUNCH);
    expect(overlapsOutage(window, [{ startedAt: at('09:00'), endedAt: at('12:01') }])).toBe(true);
    expect(overlapsOutage(window, [{ startedAt: at('13:00'), endedAt: null }])).toBe(true);
    expect(overlapsOutage(window, [{ startedAt: at('09:00'), endedAt: at('11:00') }])).toBe(false);
    expect(overlapsOutage(window, [{ startedAt: at('14:15'), endedAt: null }])).toBe(false);
  });
});

describe('planWindowClose (BR-NS-1, BR-NS-2, BR-NS-7)', () => {
  const bookings = [
    { id: 'ate', status: 'BOOKED' as const, hasAttendance: true },
    { id: 'missed', status: 'BOOKED' as const, hasAttendance: false },
    { id: 'cancelled', status: 'CANCELLED' as const, hasAttendance: false },
    { id: 'closed', status: 'CANCELLED_BY_CLOSURE' as const, hasAttendance: false },
  ];

  it('completes attended meals and records No-shows only for missed Booked meals', () => {
    expect(planWindowClose(bookings, false)).toEqual([
      { bookingId: 'ate', kind: 'COMPLETE' },
      { bookingId: 'missed', kind: 'NO_SHOW', noShowStatus: 'COUNTED' },
    ]);
  });

  it('holds No-shows for review when outage mode was on', () => {
    expect(planWindowClose(bookings, true)[1]).toMatchObject({ noShowStatus: 'HELD_FOR_REVIEW' });
  });
});

describe('decideManualMark (BR-ATT-2, ADR-0025)', () => {
  it('allows a Booked meal while the window is open', () => {
    expect(
      decideManualMark({ phase: 'OPEN', bookingStatus: 'BOOKED', hasAttendance: false }),
    ).toEqual({ canMark: true, needsReason: false, note: null });
  });

  it('needs a reason without a booking, and refuses outside the window or twice', () => {
    expect(
      decideManualMark({ phase: 'OPEN', bookingStatus: null, hasAttendance: false }),
    ).toMatchObject({
      canMark: true,
      needsReason: true,
    });
    expect(
      decideManualMark({ phase: 'CLOSED', bookingStatus: 'BOOKED', hasAttendance: false }).canMark,
    ).toBe(false);
    expect(
      decideManualMark({ phase: 'BEFORE', bookingStatus: 'BOOKED', hasAttendance: false }).canMark,
    ).toBe(false);
    expect(
      decideManualMark({ phase: 'OPEN', bookingStatus: 'BOOKED', hasAttendance: true }).canMark,
    ).toBe(false);
    expect(
      decideManualMark({ phase: 'OPEN', bookingStatus: 'CANCELLED', hasAttendance: false }).note,
    ).toBe('This meal is not booked (cancelled).');
  });
});
