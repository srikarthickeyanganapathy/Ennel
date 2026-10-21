import {
  AvailabilityLabel,
  addBusinessDays,
  type BusinessDate,
  type SlotAvailability,
  type SlotStatusLabel,
  type SlotUnavailableReason,
} from '@ennel/shared';

export interface SlotCount {
  slotId: string;
  label: string;
  startMinute: number;
  endMinute: number;
  officialCapacity: number;
  bookedCount: number;
}

export interface AvailabilityPolicy {
  allowOverCapacityBooking: boolean;
  fillingFastThresholdPct: number;
  recommendedMaxOccupancyPct: number;
}

export interface AvailabilityContext {
  date: BusinessDate;
  today: BusinessDate;
  /** Minutes since IST midnight now; only used when `date` is today. */
  nowMinute: number;
  isClosed: boolean;
  policy: AvailabilityPolicy;
}

/** ADR-0011: students may view and book from today to today + horizon (inclusive). */
export function lastBookableDate(today: BusinessDate, horizonDays: number): BusinessDate {
  return addBusinessDays(today, horizonDays);
}

export function isWithinBookingHorizon(
  date: BusinessDate,
  today: BusinessDate,
  horizonDays: number,
): boolean {
  // YYYY-MM-DD strings compare in calendar order.
  return date >= today && date <= lastBookableDate(today, horizonDays);
}

/**
 * Live slot availability for one meal on one date (Spec §5.1–5.2, BR-CAP-1..5, ADR-0013).
 * Slots must be in serving order. Pure: counts, policy and "now" are passed in.
 */
export function computeSlotAvailability(
  slots: readonly SlotCount[],
  context: AvailabilityContext,
): SlotAvailability[] {
  const rows = slots.map((slot) => describeSlot(slot, context));
  const recommendedId = pickRecommended(rows, context.policy.recommendedMaxOccupancyPct);
  return rows.map(({ ratio: _ratio, ...row }) => ({
    ...row,
    isRecommended: row.slotId === recommendedId,
  }));
}

type Row = Omit<SlotAvailability, 'isRecommended'> & { ratio: number };

function describeSlot(slot: SlotCount, context: AvailabilityContext): Row {
  const { officialCapacity: capacity, bookedCount: booked } = slot;
  // A zero-capacity slot is full; its ratio counts as 100% so it is never recommended.
  const ratio = capacity > 0 ? booked / capacity : 1;
  const status = statusFor(booked, capacity, ratio, context.policy.fillingFastThresholdPct);
  const unavailableReason = reasonUnavailable(slot, status, context);
  return {
    slotId: slot.slotId,
    label: slot.label,
    startMinute: slot.startMinute,
    endMinute: slot.endMinute,
    officialCapacity: capacity,
    bookedCount: booked,
    overCapacityCount: Math.max(0, booked - capacity),
    // Rounded down so the screen never shows 100% before the slot is actually full.
    occupancyPct: Math.min(100, Math.floor(ratio * 100)),
    status,
    canSelect: unavailableReason === null,
    unavailableReason,
    ratio,
  };
}

/** BR-CAP-5, first match wins. */
function statusFor(
  booked: number,
  capacity: number,
  ratio: number,
  fillingFastPct: number,
): SlotStatusLabel {
  if (booked > capacity) return AvailabilityLabel.OVER_CAPACITY;
  if (booked >= capacity) return AvailabilityLabel.FULL;
  if (ratio * 100 >= fillingFastPct) return AvailabilityLabel.FILLING_FAST;
  return AvailabilityLabel.AVAILABLE;
}

function reasonUnavailable(
  slot: SlotCount,
  status: SlotStatusLabel,
  context: AvailabilityContext,
): SlotUnavailableReason | null {
  if (context.isClosed) return 'CLOSED';
  // BR-DEAD-5: a slot for today can be chosen until it starts.
  if (context.date === context.today && context.nowMinute >= slot.startMinute) return 'STARTED';
  const isAtCapacity =
    status === AvailabilityLabel.FULL || status === AvailabilityLabel.OVER_CAPACITY;
  // BR-CAP-4 / ADR-0005: a slot at capacity stays open only under the over-capacity policy.
  if (isAtCapacity && !context.policy.allowOverCapacityBooking) return 'FULL';
  return null;
}

/**
 * BR-CAP-5 "Recommended": the least-occupied slot the student can still choose, if its
 * occupancy is at most the threshold. Ties go to the earlier slot. With fewer than two
 * choosable slots (e.g. Breakfast's single window) there is nothing to recommend.
 */
function pickRecommended(rows: readonly Row[], maxOccupancyPct: number): string | null {
  const candidates = rows.filter(
    (row) =>
      row.canSelect &&
      row.status !== AvailabilityLabel.FULL &&
      row.status !== AvailabilityLabel.OVER_CAPACITY,
  );
  if (candidates.length < 2) return null;
  let best: Row | undefined;
  for (const row of candidates) {
    if (!best || row.ratio < best.ratio) best = row;
  }
  return best && best.ratio * 100 <= maxOccupancyPct ? best.slotId : null;
}
