import { describe, expect, it } from 'vitest';
import {
  canAppeal,
  canReEnable,
  countInWindow,
  crossesWarning,
  levelFor,
  remainingBeforeDisable,
  shouldAutoDisable,
  windowStart,
} from './no-show-rules';

const POLICY = { noShowWindowDays: 30, noShowWarningThreshold: 3, noShowDisableThreshold: 5 };
const TODAY = '2026-11-30';

describe('rolling count (BR-NS-3)', () => {
  it('counts only COUNTED events from the last 30 days including today', () => {
    expect(windowStart(TODAY, POLICY)).toBe('2026-11-01');
    const events = [
      { date: '2026-11-01', status: 'COUNTED' as const },
      { date: '2026-10-31', status: 'COUNTED' as const },
      { date: '2026-11-20', status: 'HELD_FOR_REVIEW' as const },
      { date: '2026-11-21', status: 'EXCLUDED' as const },
      { date: '2026-11-30', status: 'COUNTED' as const },
    ];
    expect(countInWindow(events, TODAY, POLICY)).toBe(2);
  });
});

describe('levels and thresholds (Spec §10, BR-NS-4..6)', () => {
  it('maps counts to Spec §10 levels', () => {
    expect([0, 2, 3, 4, 5, 6].map((count) => levelFor(count, POLICY))).toEqual([
      'NONE',
      'NONE',
      'WARNING',
      'WARNING',
      'DISABLED',
      'DISABLED',
    ]);
    expect(remainingBeforeDisable(3, POLICY)).toBe(2);
    expect(remainingBeforeDisable(7, POLICY)).toBe(0);
  });

  it('disables at five, re-enables only below five, and warns once at three', () => {
    expect(shouldAutoDisable(5, POLICY, false)).toBe(true);
    expect(shouldAutoDisable(5, POLICY, true)).toBe(false);
    expect(canReEnable(4, POLICY, true)).toBe(true);
    expect(canReEnable(5, POLICY, true)).toBe(false);
    expect(canReEnable(2, POLICY, false)).toBe(false);
    expect(crossesWarning(2, 3, POLICY)).toBe(true);
    expect(crossesWarning(3, 4, POLICY)).toBe(false);
    expect(crossesWarning(4, 5, POLICY)).toBe(false);
  });
});

describe('canAppeal (ADR-0027)', () => {
  it('allows one report for counted or held events inside the window', () => {
    expect(canAppeal({ date: '2026-11-15', status: 'COUNTED' }, false, TODAY, POLICY)).toBe(true);
    expect(canAppeal({ date: '2026-11-15', status: 'HELD_FOR_REVIEW' }, false, TODAY, POLICY)).toBe(
      true,
    );
    expect(canAppeal({ date: '2026-11-15', status: 'COUNTED' }, true, TODAY, POLICY)).toBe(false);
    expect(canAppeal({ date: '2026-11-15', status: 'EXCLUDED' }, false, TODAY, POLICY)).toBe(false);
    expect(canAppeal({ date: '2026-10-20', status: 'COUNTED' }, false, TODAY, POLICY)).toBe(false);
  });
});
