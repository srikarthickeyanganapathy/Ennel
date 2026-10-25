import { describe, expect, it } from 'vitest';
import { classifyAttendanceRows, type StudentWindowState } from './attendance-import';

const state = (overrides: Partial<StudentWindowState>): StudentWindowState => ({
  studentId: 'student',
  bookingStatus: 'BOOKED',
  hasAttendance: false,
  noShowStatus: null,
  ...overrides,
});

describe('classifyAttendanceRows (Admin §I, ADR-0025)', () => {
  const states = new Map<string, StudentWindowState>([
    ['24900001', state({ studentId: 'booked' })],
    [
      '24900002',
      state({ studentId: 'held', bookingStatus: 'NO_SHOW', noShowStatus: 'HELD_FOR_REVIEW' }),
    ],
    [
      '24900003',
      state({ studentId: 'counted', bookingStatus: 'NO_SHOW', noShowStatus: 'COUNTED' }),
    ],
    ['24900004', state({ studentId: 'ate', hasAttendance: true })],
    ['24900005', state({ studentId: 'none', bookingStatus: null })],
    ['24900006', state({ studentId: 'cancelled', bookingStatus: 'CANCELLED' })],
  ]);

  it('accepts Booked meals and held No-shows only', () => {
    const rows = classifyAttendanceRows(
      ['24 900 001', '24900002', '24900003', '24900004', '24900005', '24900006'],
      states,
    );
    expect(rows.map((row) => row.outcome)).toEqual([
      'VALID',
      'VALID',
      'INVALID',
      'EXISTING_UNCHANGED',
      'INVALID',
      'INVALID',
    ]);
    expect(rows[0]).toMatchObject({
      rowNumber: 2,
      referenceNumber: '24900001',
      studentId: 'booked',
    });
    expect(rows[2]?.message).toMatch(/No-show review/);
  });

  it('flags blanks, unknown students and repeats', () => {
    const rows = classifyAttendanceRows(['', '99999999', '24900001', '24900001'], states);
    expect(rows.map((row) => row.outcome)).toEqual([
      'INVALID',
      'INVALID',
      'VALID',
      'DUPLICATE_IN_FILE',
    ]);
  });
});
