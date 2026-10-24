import { describe, expect, it } from 'vitest';
import { type ExistingBooking, planReconciliation, type ReconcileInput } from './reconcile-booking';

const POLICY = { cancellationCutoffMinutes: 60, dietTypeChangeCutoffMinutes: 60 };
const SLOTS = new Map([
  ['s11', 11 * 60],
  ['s12', 12 * 60],
]);
const DEFAULT_BOOK = {
  kind: 'BOOK',
  source: 'DEFAULT',
  appliedRule: 'DEFAULT',
  slotId: 's11',
  dietType: 'VEG',
} as const;
const BOOKED: ExistingBooking = {
  status: 'BOOKED',
  source: 'DEFAULT',
  slotId: 's11',
  slotStartMinute: 11 * 60,
  dietType: 'VEG',
  lastActorType: 'SYSTEM',
};

/** 9:00 AM IST on the meal date. */
const base = (overrides: Partial<ReconcileInput>): ReconcileInput => ({
  date: '2026-10-25',
  now: new Date('2026-10-25T03:30:00.000Z'),
  existing: null,
  resolution: DEFAULT_BOOK,
  slotStarts: SLOTS,
  policy: POLICY,
  ...overrides,
});
const plan = (overrides: Partial<ReconcileInput>) => planReconciliation(base(overrides)).kind;

describe('planReconciliation (BR-DEF-1/3, ADR-0003)', () => {
  it('creates a missing Default Booking, but not once the slot has started', () => {
    expect(planReconciliation(base({}))).toEqual({
      kind: 'CREATE',
      slotId: 's11',
      dietType: 'VEG',
      source: 'DEFAULT',
    });
    expect(plan({ now: new Date('2026-10-25T05:30:00.000Z') })).toBe('NONE');
  });

  it('leaves alone what students, staff, leave and closures own', () => {
    expect(plan({ existing: { ...BOOKED, source: 'MANUAL' } })).toBe('NONE');
    expect(plan({ existing: { ...BOOKED, source: 'ADMIN' } })).toBe('NONE');
    expect(plan({ existing: { ...BOOKED, status: 'PAUSED_LEAVE' } })).toBe('NONE');
    expect(plan({ existing: { ...BOOKED, status: 'CANCELLED', lastActorType: 'STUDENT' } })).toBe(
      'NONE',
    );
    expect(
      plan({
        resolution: {
          kind: 'BOOK',
          source: 'MANUAL',
          appliedRule: 'DATE_EXCEPTION',
          slotId: 's12',
          dietType: 'VEG',
        },
      }),
    ).toBe('NONE');
  });

  it('cancels a recurring booking that is no longer wanted, only before the cancellation deadline (BR-DEF-3)', () => {
    const off = { kind: 'NONE', appliedRule: 'NONE' } as const;
    expect(plan({ existing: BOOKED, resolution: off })).toBe('CANCEL');
    expect(
      plan({ existing: BOOKED, resolution: off, now: new Date('2026-10-25T04:30:00.000Z') }),
    ).toBe('NONE');
    expect(plan({ existing: BOOKED, resolution: { kind: 'CLOSED', appliedRule: 'CLOSURE' } })).toBe(
      'NONE',
    );
  });

  it('brings back a booking the system cancelled when Default Booking is switched on again', () => {
    expect(plan({ existing: { ...BOOKED, status: 'CANCELLED', lastActorType: 'SYSTEM' } })).toBe(
      'REACTIVATE',
    );
  });

  it('moves a recurring booking to the new preference while changes are still allowed', () => {
    const newSlot = { ...DEFAULT_BOOK, slotId: 's12' };
    expect(plan({ existing: BOOKED, resolution: newSlot })).toBe('UPDATE');
    expect(
      plan({ existing: BOOKED, resolution: newSlot, now: new Date('2026-10-25T05:30:00.000Z') }),
    ).toBe('NONE');
    expect(plan({ existing: BOOKED, resolution: { ...DEFAULT_BOOK, dietType: 'NON_VEG' } })).toBe(
      'UPDATE',
    );
    expect(
      plan({
        existing: BOOKED,
        resolution: { ...DEFAULT_BOOK, dietType: 'NON_VEG' },
        now: new Date('2026-10-25T04:30:00.000Z'),
      }),
    ).toBe('NONE');
    expect(plan({ existing: BOOKED })).toBe('NONE');
  });

  it('ignores a preferred slot that is no longer offered', () => {
    expect(plan({ resolution: { ...DEFAULT_BOOK, slotId: 'gone' } })).toBe('NONE');
  });
});
