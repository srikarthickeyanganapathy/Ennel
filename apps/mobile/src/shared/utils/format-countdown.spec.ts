import { formatTimeLeft } from './format-countdown';

const NOW = new Date('2026-10-22T03:30:00.000Z'); // 9:00 AM IST

describe('formatTimeLeft (Spec §4.5)', () => {
  it('matches the spec example: one hour before a 10:00 AM deadline', () => {
    expect(formatTimeLeft('2026-10-22T04:30:00.000Z', NOW)).toBe('1 hr');
  });

  it('shows hours and minutes, rounding minutes up', () => {
    expect(formatTimeLeft('2026-10-22T04:35:30.000Z', NOW)).toBe('1 hr 6 min');
    expect(formatTimeLeft('2026-10-22T03:30:20.000Z', NOW)).toBe('1 min');
    expect(formatTimeLeft('2026-10-24T05:30:00.000Z', NOW)).toBe('2 d 2 hr');
  });

  it('returns null once the deadline has passed', () => {
    expect(formatTimeLeft('2026-10-22T03:30:00.000Z', NOW)).toBeNull();
  });
});
