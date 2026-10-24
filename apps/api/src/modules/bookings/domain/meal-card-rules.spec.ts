import { describe, expect, it } from 'vitest';
import {
  type ActionContext,
  bookingDeadlines,
  deriveBookingLabel,
  isDeadlinePassed,
  type LabelInput,
  mealActions,
} from './meal-card-rules';

const POLICY = { cancellationCutoffMinutes: 60, dietTypeChangeCutoffMinutes: 60 };
// 2026-10-22 09:00 IST
const NINE_AM = new Date('2026-10-22T03:30:00.000Z');
const LUNCH_START = 11 * 60;

describe('deadlines (BR-DEAD-1..4, Spec §4.5)', () => {
  it('closes cancellation an hour before the slot and slot changes at its start', () => {
    const deadlines = bookingDeadlines('2026-10-22', LUNCH_START, POLICY);
    expect(deadlines.cancelAt.toISOString()).toBe('2026-10-22T04:30:00.000Z'); // 10:00 AM IST
    expect(deadlines.changeSlotAt.toISOString()).toBe('2026-10-22T05:30:00.000Z'); // 11:00 AM IST
    expect(deadlines.changeDietAt.toISOString()).toBe('2026-10-22T04:30:00.000Z');
  });

  it('treats the exact deadline as passed', () => {
    const deadline = new Date('2026-10-22T04:30:00.000Z');
    expect(isDeadlinePassed(deadline, new Date('2026-10-22T04:29:59.999Z'))).toBe(false);
    expect(isDeadlinePassed(deadline, deadline)).toBe(true);
  });
});

const BASE_CONTEXT: ActionContext = {
  now: NINE_AM,
  date: '2026-10-22',
  isClosed: false,
  isOnLeave: false,
  isWithinHorizon: true,
  lastSlotStartMinute: 13 * 60,
  booking: null,
  policy: POLICY,
};

describe('meal card actions (Spec §4.3, §14)', () => {
  it('offers Book until the last slot starts, then explains why not', () => {
    expect(mealActions(BASE_CONTEXT).book).toMatchObject({
      allowed: true,
      deadlineAt: '2026-10-22T07:30:00.000Z',
    });
    const late = mealActions({ ...BASE_CONTEXT, now: new Date('2026-10-22T07:30:00.000Z') }).book;
    expect(late).toEqual({
      allowed: false,
      reason: 'All slots for this meal have started.',
      deadlineAt: null,
    });
  });

  it('refuses Book for closures, leave and dates outside the booking period', () => {
    expect(mealActions({ ...BASE_CONTEXT, isClosed: true }).book.reason).toBe(
      'The mess is closed for this meal.',
    );
    expect(mealActions({ ...BASE_CONTEXT, isOnLeave: true }).book.reason).toBe(
      'You are on leave for this meal.',
    );
    expect(mealActions({ ...BASE_CONTEXT, isWithinHorizon: false }).book.reason).toBe(
      'This date is outside the booking period.',
    );
  });

  it('gives a booked meal Change, meal type and Cancel with countdown deadlines', () => {
    const actions = mealActions({
      ...BASE_CONTEXT,
      booking: { status: 'BOOKED', slotStartMinute: LUNCH_START },
    });
    expect(actions.book.allowed).toBe(false);
    expect(actions.cancel).toEqual({
      allowed: true,
      reason: null,
      deadlineAt: '2026-10-22T04:30:00.000Z',
    });
    expect(actions.changeSlot.allowed).toBe(true);
  });

  it('closes Cancel at 10:00 AM for an 11:00 AM slot and says so (Spec §4.5 example)', () => {
    const tenThirty = new Date('2026-10-22T05:00:00.000Z');
    const actions = mealActions({
      ...BASE_CONTEXT,
      now: tenThirty,
      booking: { status: 'BOOKED', slotStartMinute: LUNCH_START },
    });
    expect(actions.cancel).toMatchObject({
      allowed: false,
      reason: 'Cancellation closed at 10:00 AM.',
    });
    expect(actions.changeSlot.allowed).toBe(true);
  });

  it('lets a cancelled meal be booked again but never changes attendance outcomes', () => {
    expect(
      mealActions({
        ...BASE_CONTEXT,
        booking: { status: 'CANCELLED', slotStartMinute: LUNCH_START },
      }).book.allowed,
    ).toBe(true);
    const completed = mealActions({
      ...BASE_CONTEXT,
      booking: { status: 'COMPLETED', slotStartMinute: LUNCH_START },
    });
    expect(Object.values(completed).every((action) => !action.allowed)).toBe(true);
  });
});

const NONE = { kind: 'NONE', appliedRule: 'NONE' } as const;
const DEFAULT_BOOK = {
  kind: 'BOOK',
  source: 'DEFAULT',
  appliedRule: 'DEFAULT',
  slotId: 's1',
  dietType: 'VEG',
} as const;
const label = (input: Partial<LabelInput>) =>
  deriveBookingLabel({
    booking: null,
    resolution: NONE,
    recurring: NONE,
    isDefaultOff: false,
    ...input,
  });

describe('status labels (BR-BOOK-3)', () => {
  it('labels meals without a booking', () => {
    expect(label({ isDefaultOff: true })).toBe('NOT_BOOKED_DEFAULT_OFF');
    expect(label({})).toBe('NOT_BOOKED');
    expect(label({ resolution: { kind: 'CLOSED', appliedRule: 'CLOSURE' } })).toBe('MESS_CLOSED');
    expect(label({ resolution: { kind: 'PAUSED_LEAVE', appliedRule: 'LEAVE' } })).toBe(
      'PAUSED_LEAVE',
    );
  });

  it('tells a one-time booking from a change to a recurring one', () => {
    const manual = { status: 'BOOKED', source: 'MANUAL', slotId: 's2', dietType: 'VEG' } as const;
    expect(label({ booking: manual })).toBe('BOOKED_ONCE');
    expect(label({ booking: manual, recurring: DEFAULT_BOOK })).toBe('CHANGED_FOR_THIS_DAY');
    expect(label({ booking: { ...manual, slotId: 's1' }, recurring: DEFAULT_BOOK })).toBe(
      'BOOKED_DEFAULT',
    );
    expect(label({ booking: { ...manual, source: 'DEFAULT' } })).toBe('BOOKED_DEFAULT');
    expect(label({ booking: { ...manual, source: 'PLAN_AHEAD_WEEKDAY' } })).toBe(
      'BOOKED_WEEKDAY_RULE',
    );
  });

  it('labels every other status', () => {
    const of = (
      status: 'CANCELLED' | 'PAUSED_LEAVE' | 'CANCELLED_BY_CLOSURE' | 'NO_SHOW' | 'COMPLETED',
    ) => label({ booking: { status, source: 'MANUAL', slotId: 's1', dietType: 'VEG' } });
    expect(of('CANCELLED')).toBe('CANCELLED');
    expect(of('PAUSED_LEAVE')).toBe('PAUSED_LEAVE');
    expect(of('CANCELLED_BY_CLOSURE')).toBe('MESS_CLOSED');
    expect(of('NO_SHOW')).toBe('NO_SHOW');
    expect(of('COMPLETED')).toBe('COMPLETED');
  });
});
