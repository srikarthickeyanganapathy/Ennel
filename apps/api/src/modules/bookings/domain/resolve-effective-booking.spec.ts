import { describe, expect, it } from 'vitest';
import {
  type DefaultIntent,
  type ResolutionInput,
  resolveEffectiveBooking,
} from './resolve-effective-booking';

const DEFAULT_ON: DefaultIntent = {
  isOverallEnabled: true,
  isMealEnabled: true,
  isAutoDisabled: false,
  slotId: 'default-slot',
  dietType: 'VEG',
};
const WEEKDAY = { slotId: 'weekday-slot', dietType: 'NON_VEG' as const };
const BOOK_EXCEPTION = {
  action: 'BOOK' as const,
  slotId: 'once-slot',
  dietType: 'VEG' as const,
  origin: 'MANUAL' as const,
};
const SKIP_EXCEPTION = {
  action: 'SKIP' as const,
  slotId: null,
  dietType: null,
  origin: 'MANUAL' as const,
};

const NOTHING: ResolutionInput = {
  isClosed: false,
  isOnApprovedLeave: false,
  dateException: null,
  weekdayRule: null,
  defaultIntent: null,
};

describe('resolveEffectiveBooking (BR-BOOK-4: closure > leave > date exception > weekday > default)', () => {
  it('resolves to nothing without any intent', () => {
    expect(resolveEffectiveBooking(NOTHING)).toEqual({ kind: 'NONE', appliedRule: 'NONE' });
  });

  it('lets each rule beat every rule below it', () => {
    const all: ResolutionInput = {
      isClosed: true,
      isOnApprovedLeave: true,
      dateException: BOOK_EXCEPTION,
      weekdayRule: WEEKDAY,
      defaultIntent: DEFAULT_ON,
    };
    expect(resolveEffectiveBooking(all).appliedRule).toBe('CLOSURE');
    expect(resolveEffectiveBooking({ ...all, isClosed: false }).appliedRule).toBe('LEAVE');
    expect(
      resolveEffectiveBooking({ ...all, isClosed: false, isOnApprovedLeave: false }),
    ).toMatchObject({
      kind: 'BOOK',
      appliedRule: 'DATE_EXCEPTION',
      slotId: 'once-slot',
      source: 'MANUAL',
    });
    expect(
      resolveEffectiveBooking({ ...NOTHING, weekdayRule: WEEKDAY, defaultIntent: DEFAULT_ON }),
    ).toMatchObject({
      kind: 'BOOK',
      appliedRule: 'WEEKDAY_RULE',
      slotId: 'weekday-slot',
      source: 'PLAN_AHEAD_WEEKDAY',
    });
    expect(resolveEffectiveBooking({ ...NOTHING, defaultIntent: DEFAULT_ON })).toMatchObject({
      kind: 'BOOK',
      appliedRule: 'DEFAULT',
      source: 'DEFAULT',
    });
  });

  it('treats a skipped day as no booking even when a recurring rule would book (ADR-0003)', () => {
    expect(
      resolveEffectiveBooking({
        ...NOTHING,
        dateException: SKIP_EXCEPTION,
        weekdayRule: WEEKDAY,
        defaultIntent: DEFAULT_ON,
      }),
    ).toEqual({ kind: 'NONE', appliedRule: 'DATE_EXCEPTION' });
  });

  it('applies Default Booking only with both switches on, no auto-disable and a slot (BR-BOOK-6)', () => {
    const resolve = (intent: Partial<DefaultIntent>) =>
      resolveEffectiveBooking({ ...NOTHING, defaultIntent: { ...DEFAULT_ON, ...intent } }).kind;
    expect(resolve({})).toBe('BOOK');
    expect(resolve({ isOverallEnabled: false })).toBe('NONE');
    expect(resolve({ isMealEnabled: false })).toBe('NONE');
    expect(resolve({ isAutoDisabled: true })).toBe('NONE');
    expect(resolve({ slotId: undefined })).toBe('NONE');
  });
});
