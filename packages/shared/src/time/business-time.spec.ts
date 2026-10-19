import { describe, expect, it } from 'vitest';
import {
  addBusinessDays,
  formatMinuteOfDay,
  getBusinessWeekday,
  isBusinessDate,
  toBusinessDate,
  toInstant,
  toMinuteOfDay,
} from './business-time.js';

describe('business time (ADR-0002)', () => {
  it('converts an IST slot start to the UTC instant', () => {
    // Lunch 11:00 AM IST = 05:30 UTC.
    expect(toInstant('2026-10-19', 11 * 60).toISOString()).toBe('2026-10-19T05:30:00.000Z');
  });

  it('handles early-morning IST times that fall on the previous UTC day', () => {
    // Breakfast 7:00 AM IST on 20 Oct = 01:30 UTC on 20 Oct; 1:00 AM IST = 19:30 UTC on 19 Oct.
    expect(toInstant('2026-10-20', 60).toISOString()).toBe('2026-10-19T19:30:00.000Z');
  });

  it('treats minute 1440 as the end of the date', () => {
    expect(toInstant('2026-10-19', 1440).toISOString()).toBe('2026-10-19T18:30:00.000Z');
  });

  it('rejects invalid minutes and dates', () => {
    expect(() => toInstant('2026-10-19', -1)).toThrow(RangeError);
    expect(() => toInstant('2026-10-19', 1441)).toThrow(RangeError);
    expect(() => toInstant('2026-02-30', 0)).toThrow(RangeError);
  });

  it('maps instants back to the IST business date across midnight', () => {
    expect(toBusinessDate(new Date('2026-10-19T18:29:59.000Z'))).toBe('2026-10-19');
    expect(toBusinessDate(new Date('2026-10-19T18:30:00.000Z'))).toBe('2026-10-20');
  });

  it('returns minutes since IST midnight', () => {
    expect(toMinuteOfDay(new Date('2026-10-19T05:30:00.000Z'))).toBe(660);
  });

  it('computes IST weekdays and adds days across month ends', () => {
    expect(getBusinessWeekday('2026-10-19')).toBe(1); // Monday
    expect(addBusinessDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addBusinessDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('validates business dates', () => {
    expect(isBusinessDate('2026-10-19')).toBe(true);
    expect(isBusinessDate('2026-13-01')).toBe(false);
    expect(isBusinessDate('19-10-2026')).toBe(false);
  });

  it('formats times with AM/PM', () => {
    expect(formatMinuteOfDay(0)).toBe('12:00 AM');
    expect(formatMinuteOfDay(7 * 60)).toBe('7:00 AM');
    expect(formatMinuteOfDay(12 * 60 + 30)).toBe('12:30 PM');
    expect(formatMinuteOfDay(18 * 60 + 45)).toBe('6:45 PM');
  });
});
