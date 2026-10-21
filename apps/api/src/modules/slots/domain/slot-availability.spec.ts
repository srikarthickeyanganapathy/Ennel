import { describe, expect, it } from 'vitest';
import {
  type AvailabilityContext,
  computeSlotAvailability,
  isWithinBookingHorizon,
  lastBookableDate,
  type SlotCount,
} from './slot-availability';

const POLICY = {
  allowOverCapacityBooking: false,
  fillingFastThresholdPct: 80,
  recommendedMaxOccupancyPct: 60,
};
const CONTEXT: AvailabilityContext = {
  date: '2026-10-22',
  today: '2026-10-21',
  nowMinute: 9 * 60,
  isClosed: false,
  policy: POLICY,
};

function slot(index: number, bookedCount: number, officialCapacity = 100): SlotCount {
  const startMinute = 11 * 60 + index * 30;
  return {
    slotId: `slot-${index}`,
    label: `slot ${index}`,
    startMinute,
    endMinute: startMinute + 30,
    officialCapacity,
    bookedCount,
  };
}

const statusOf = (slots: SlotCount[], context = CONTEXT) =>
  computeSlotAvailability(slots, context).map((row) => row.status);

describe('computeSlotAvailability (BR-CAP-3/5, Spec §5.1)', () => {
  it('labels slots by occupancy, first match wins', () => {
    expect(statusOf([slot(0, 10), slot(1, 79), slot(2, 80), slot(3, 100), slot(4, 107)])).toEqual([
      'AVAILABLE',
      'AVAILABLE',
      'FILLING_FAST',
      'FULL',
      'OVER_CAPACITY',
    ]);
  });

  it('reports counts as the screen shows them (Spec §5.2: 507 accepted of 500)', () => {
    const [row] = computeSlotAvailability([slot(0, 507, 500)], CONTEXT);
    expect(row).toMatchObject({
      bookedCount: 507,
      officialCapacity: 500,
      overCapacityCount: 7,
      occupancyPct: 100,
    });
  });

  it('rounds occupancy down so 99.6% never shows as 100%', () => {
    const [row] = computeSlotAvailability([slot(0, 498, 500)], CONTEXT);
    expect(row).toMatchObject({ occupancyPct: 99, status: 'FILLING_FAST' });
  });

  it('treats a zero-capacity slot as full', () => {
    const [row] = computeSlotAvailability([slot(0, 0, 0)], CONTEXT);
    expect(row).toMatchObject({
      status: 'FULL',
      occupancyPct: 100,
      canSelect: false,
      unavailableReason: 'FULL',
    });
  });
});

describe('which slots can be chosen (BR-CAP-4, BR-DEAD-5)', () => {
  it('disables a full slot unless over-capacity booking is allowed (ADR-0005)', () => {
    const blocked = computeSlotAvailability([slot(0, 100)], CONTEXT)[0];
    expect(blocked).toMatchObject({ canSelect: false, unavailableReason: 'FULL' });

    const allowed = computeSlotAvailability([slot(0, 100)], {
      ...CONTEXT,
      policy: { ...POLICY, allowOverCapacityBooking: true },
    })[0];
    expect(allowed).toMatchObject({ canSelect: true, unavailableReason: null, status: 'FULL' });
  });

  it('closes slots for today once they have started', () => {
    const today = { ...CONTEXT, date: CONTEXT.today, nowMinute: 11 * 60 + 30 };
    const rows = computeSlotAvailability([slot(0, 0), slot(1, 0), slot(2, 0)], today);
    expect(rows.map((row) => row.unavailableReason)).toEqual(['STARTED', 'STARTED', null]);
  });

  it('closes every slot when the meal is closed', () => {
    const rows = computeSlotAvailability([slot(0, 0), slot(1, 0)], { ...CONTEXT, isClosed: true });
    expect(rows.every((row) => row.unavailableReason === 'CLOSED' && !row.canSelect)).toBe(true);
    expect(rows.some((row) => row.isRecommended)).toBe(false);
  });
});

describe('Recommended flag (ADR-0013)', () => {
  const recommended = (slots: SlotCount[], context = CONTEXT) =>
    computeSlotAvailability(slots, context)
      .filter((row) => row.isRecommended)
      .map((row) => row.slotId);

  it('marks the least-occupied slot at or below 60%, earliest on ties', () => {
    expect(recommended([slot(0, 70), slot(1, 40), slot(2, 40)])).toEqual(['slot-1']);
    expect(recommended([slot(0, 60), slot(1, 75)])).toEqual(['slot-0']);
  });

  it('recommends nothing when every slot is busier than the threshold', () => {
    expect(recommended([slot(0, 61), slot(1, 90)])).toEqual([]);
  });

  it('skips slots the student cannot choose and single-window meals', () => {
    const today = { ...CONTEXT, date: CONTEXT.today, nowMinute: 11 * 60 };
    expect(recommended([slot(0, 0), slot(1, 30), slot(2, 50)], today)).toEqual(['slot-1']);
    expect(recommended([slot(0, 0)])).toEqual([]);
  });
});

describe('booking horizon (ADR-0011)', () => {
  it('allows today through today + horizon days', () => {
    expect(lastBookableDate('2026-10-21', 7)).toBe('2026-10-28');
    expect(isWithinBookingHorizon('2026-10-21', '2026-10-21', 7)).toBe(true);
    expect(isWithinBookingHorizon('2026-10-28', '2026-10-21', 7)).toBe(true);
    expect(isWithinBookingHorizon('2026-10-29', '2026-10-21', 7)).toBe(false);
    expect(isWithinBookingHorizon('2026-10-20', '2026-10-21', 7)).toBe(false);
  });
});
