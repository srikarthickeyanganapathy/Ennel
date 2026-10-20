import { describe, expect, it } from 'vitest';
import {
  blockKey,
  classifyRosterRows,
  type ExistingRosterEntry,
  mapHeaders,
} from './roster-import';

const HEADERS = [
  'Reference Number',
  'Full Name',
  'Department',
  'Academic_Year',
  'Hostel',
  'Block',
  'Room Number',
  'Email',
  'Notes',
];
const BLOCKS = new Map([[blockKey('Hostel A', 'Block A'), 'block-a']]);

const row = (overrides: Partial<Record<string, string>> = {}) => {
  const values = {
    ref: '24 900 001',
    name: 'Asha Rao',
    department: 'Civil',
    year: '2',
    hostel: 'Hostel A',
    block: 'Block A',
    room: '101',
    email: 'Asha@Example.com',
    ...overrides,
  };
  return [
    values.ref,
    values.name,
    values.department,
    values.year,
    values.hostel,
    values.block,
    values.room,
    values.email,
    'ignored',
  ];
};

function classify(rows: string[][], existing = new Map<string, ExistingRosterEntry>()) {
  const { columns } = mapHeaders(HEADERS);
  return classifyRosterRows(columns, rows, existing, BLOCKS);
}

describe('roster import classification (Admin §G)', () => {
  it('maps headers flexibly and reports missing required columns', () => {
    expect(mapHeaders(HEADERS).missing).toEqual([]);
    expect(mapHeaders(['Full Name', 'Hostel']).missing).toEqual([
      'referenceNumber',
      'department',
      'academicYear',
    ]);
  });

  it('accepts a valid new row and normalizes it', () => {
    const [result] = classify([row()]);
    expect(result).toMatchObject({
      rowNumber: 2,
      outcome: 'VALID',
      value: { referenceNumber: '24900001', email: 'asha@example.com', hostelBlockId: 'block-a' },
    });
  });

  it('reports row-level errors with the field name', () => {
    const [result] = classify([row({ year: 'two', email: 'nope' })]);
    expect(result?.outcome).toBe('INVALID');
    expect(result?.errors.map((error) => error.field).sort()).toEqual(['academicYear', 'email']);
  });

  it('rejects unknown hostel blocks and half-filled hostel columns', () => {
    expect(classify([row({ block: 'Block Z' })])[0]?.errors[0]?.message).toMatch(
      /No block "Block Z"/,
    );
    expect(classify([row({ block: '' })])[0]?.outcome).toBe('INVALID');
  });

  it('allows a row with no hostel at all', () => {
    expect(classify([row({ hostel: '', block: '', room: '' })])[0]).toMatchObject({
      outcome: 'VALID',
      value: { hostelBlockId: null, roomNumber: null },
    });
  });

  it('flags every occurrence of a duplicated reference number', () => {
    const results = classify([row(), row({ ref: '24900001', name: 'Someone Else' })]);
    expect(results.map((result) => result.outcome)).toEqual([
      'DUPLICATE_IN_FILE',
      'DUPLICATE_IN_FILE',
    ]);
  });

  it('distinguishes unchanged and updated existing entries', () => {
    const existing = new Map<string, ExistingRosterEntry>([
      [
        '24900001',
        {
          fullName: 'Asha Rao',
          department: 'Civil',
          academicYear: 2,
          hostelBlockId: 'block-a',
          roomNumber: '101',
          email: 'asha@example.com',
        },
      ],
      [
        '24900002',
        {
          fullName: 'Ben',
          department: 'Civil',
          academicYear: 1,
          hostelBlockId: null,
          roomNumber: null,
          email: null,
        },
      ],
    ]);
    const results = classify(
      [
        row(),
        row({
          ref: '24900002',
          name: 'Ben',
          year: '2',
          hostel: '',
          block: '',
          room: '',
          email: '',
        }),
      ],
      existing,
    );
    expect(results[0]?.outcome).toBe('EXISTING_UNCHANGED');
    expect(results[1]).toMatchObject({ outcome: 'EXISTING_UPDATE', changes: ['academicYear'] });
  });
});
