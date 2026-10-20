import { describe, expect, it } from 'vitest';
import { resolveOfficialCapacity } from '../../../mess-config/domain/capacity';
import { diffPolicy, findPolicyProblems } from './policy-rules';
import {
  buildSlotLabel,
  canAddSlot,
  findMealWindowProblem,
  findSlotWindowProblem,
  isSlotInUse,
} from './slot-rules';
import { hashMenuContent, isPublishedChange, listDates } from '../../admin-menus/domain/menu-rules';

const LUNCH = { startMinute: 660, endMinute: 810 };

describe('capacity resolution (BR-CAP-1)', () => {
  it('prefers the date override, then the weekday default, then the slot default', () => {
    expect(
      resolveOfficialCapacity({
        defaultCapacity: 500,
        weekdayCapacity: 400,
        overrideCapacity: 300,
      }),
    ).toBe(300);
    expect(
      resolveOfficialCapacity({
        defaultCapacity: 500,
        weekdayCapacity: 400,
        overrideCapacity: null,
      }),
    ).toBe(400);
    expect(
      resolveOfficialCapacity({
        defaultCapacity: 500,
        weekdayCapacity: null,
        overrideCapacity: null,
      }),
    ).toBe(500);
    expect(
      resolveOfficialCapacity({ defaultCapacity: 500, weekdayCapacity: null, overrideCapacity: 0 }),
    ).toBe(0);
  });
});

describe('slot rules (BR-MEAL-4)', () => {
  it('labels slots in AM/PM', () => {
    expect(buildSlotLabel({ startMinute: 690, endMinute: 720 })).toBe('11:30 AM - 12:00 PM');
  });

  it('requires a positive length inside the serving window without overlap', () => {
    expect(findSlotWindowProblem({ startMinute: 700, endMinute: 700 }, LUNCH, [])).toMatch(
      /end after/,
    );
    expect(findSlotWindowProblem({ startMinute: 630, endMinute: 660 }, LUNCH, [])).toMatch(
      /serving window/,
    );
    expect(
      findSlotWindowProblem({ startMinute: 680, endMinute: 710 }, LUNCH, [
        { startMinute: 660, endMinute: 690 },
      ]),
    ).toMatch(/overlaps 11:00 AM/);
    expect(
      findSlotWindowProblem({ startMinute: 690, endMinute: 720 }, LUNCH, [
        { startMinute: 660, endMinute: 690 },
      ]),
    ).toBeNull();
  });

  it('keeps active slots inside an edited serving window', () => {
    expect(
      findMealWindowProblem({ startMinute: 680, endMinute: 810 }, [
        { startMinute: 660, endMinute: 690 },
      ]),
    ).toMatch(/outside/);
    expect(findMealWindowProblem(LUNCH, [{ startMinute: 660, endMinute: 690 }])).toBeNull();
  });

  it('never adds slots to Breakfast', () => {
    expect(canAddSlot('BREAKFAST')).toBe(false);
    expect(canAddSlot('DINNER')).toBe(true);
  });

  it('treats any future booking or saved choice as usage', () => {
    expect(
      isSlotInUse({ futureBookings: 0, preferences: 0, weekdayRules: 0, dateExceptions: 0 }),
    ).toBe(false);
    expect(
      isSlotInUse({ futureBookings: 0, preferences: 1, weekdayRules: 0, dateExceptions: 0 }),
    ).toBe(true);
  });
});

describe('policy rules (ADR-0009, ADR-0013)', () => {
  const policy = {
    noShowWarningThreshold: 3,
    noShowDisableThreshold: 5,
    fillingFastThresholdPct: 80,
    recommendedMaxOccupancyPct: 60,
  };

  it('accepts the defaults and rejects inverted thresholds', () => {
    expect(findPolicyProblems(policy)).toEqual([]);
    expect(
      findPolicyProblems({ ...policy, noShowWarningThreshold: 5 }).map((issue) => issue.path),
    ).toEqual(['noShowWarningThreshold']);
    expect(
      findPolicyProblems({ ...policy, recommendedMaxOccupancyPct: 85 }).map((issue) => issue.path),
    ).toEqual(['recommendedMaxOccupancyPct']);
  });

  it('diffs only changed fields', () => {
    expect(diffPolicy({ a: 1, b: [1], c: true }, { a: 1, b: [2], c: undefined })).toEqual({
      before: { b: [1] },
      after: { b: [2] },
    });
  });
});

describe('menu rules (Admin §E)', () => {
  const content = {
    items: [{ name: 'Rice', dietType: 'VEG' as const }],
    isSpecial: false,
    specialTitle: null,
  };

  it('hashes content stably, ignoring whitespace and stale special titles', () => {
    expect(hashMenuContent(content)).toBe(
      hashMenuContent({
        ...content,
        items: [{ name: ' Rice ', dietType: 'VEG' }],
        specialTitle: 'old',
      }),
    );
    expect(hashMenuContent(content)).not.toBe(
      hashMenuContent({ ...content, items: [{ name: 'Rice', dietType: 'NON_VEG' }] }),
    );
  });

  it('treats only a changed republish as a change', () => {
    expect(isPublishedChange(null, 'a')).toBe(false);
    expect(isPublishedChange('a', 'a')).toBe(false);
    expect(isPublishedChange('a', 'b')).toBe(true);
  });

  it('lists consecutive dates across a month end', () => {
    expect(listDates('2026-10-30', 3)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01']);
  });
});
