import {
  addBusinessDays,
  type AdminReport,
  type BusinessDate,
  CANCELLATION_BUCKETS,
  type CancellationBucket,
  getBusinessWeekday,
  type MealType,
  type ReportGrouping,
  toInstant,
} from '@ennel/shared';
import { wastedPlates } from '../../../forecasting/domain/kitchen-forecast';

export interface BookingCount {
  date: BusinessDate;
  mealId: string;
  slotId: string;
  status: string;
  isOverCapacity: boolean;
  count: number;
}

export interface MealInfo {
  id: string;
  mealType: MealType;
  mealName: string;
}

export interface SlotInfo {
  slotId: string;
  mealId: string;
  mealType: MealType;
  label: string;
  startMinute: number;
  defaultCapacity: number;
  weekdayCapacities: { weekday: number; capacity: number }[];
  dateCapacities: { date: BusinessDate; capacity: number }[];
}

interface Tally {
  served: number;
  cancelled: number;
  noShows: number;
  pending: number;
}

const EMPTY: Tally = { served: 0, cancelled: 0, noShows: 0, pending: 0 };
const MINUTES_PER_HOUR = 60;

function addToTally(tally: Tally, status: string, count: number): Tally {
  if (status === 'COMPLETED') return { ...tally, served: tally.served + count };
  if (status === 'CANCELLED') return { ...tally, cancelled: tally.cancelled + count };
  if (status === 'NO_SHOW') return { ...tally, noShows: tally.noShows + count };
  return status === 'BOOKED' ? { ...tally, pending: tally.pending + count } : tally;
}

export function tallyOf(rows: readonly Pick<BookingCount, 'status' | 'count'>[]): Tally {
  return rows.reduce((tally, row) => addToTally(tally, row.status, row.count), EMPTY);
}

/** ADR-0029: every booking still counted for the meal; closures and leave are not. */
export const tallyTotal = (tally: Tally): number =>
  tally.served + tally.cancelled + tally.noShows + tally.pending;

/** The same definition as the dashboard: No-shows ÷ (served + No-shows). Null without data. */
export function noShowRatePct(tally: Pick<Tally, 'served' | 'noShows'>): number | null {
  const finished = tally.served + tally.noShows;
  return finished === 0 ? null : Math.round((tally.noShows / finished) * 100);
}

/** ADR-0029: plates cooked for finished bookings that nobody came for. */
export const wasteOf = (tally: Pick<Tally, 'served' | 'noShows'>): number =>
  wastedPlates({ booked: tally.served + tally.noShows, served: tally.served });

/** The first day of the period: the day, its Monday, or the 1st of the month. */
export function periodStart(date: BusinessDate, grouping: ReportGrouping): BusinessDate {
  if (grouping === 'day') return date;
  if (grouping === 'month') return `${date.slice(0, 7)}-01`;
  return addBusinessDays(date, -((getBusinessWeekday(date) + 6) % 7));
}

export function reportSeries(
  rows: readonly BookingCount[],
  grouping: ReportGrouping,
): AdminReport['series'] {
  const periods = new Map<BusinessDate, BookingCount[]>();
  for (const row of rows) {
    const key = periodStart(row.date, grouping);
    periods.set(key, [...(periods.get(key) ?? []), row]);
  }
  return [...periods.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, entries]) => {
      const tally = tallyOf(entries);
      return {
        period,
        booked: tallyTotal(tally),
        served: tally.served,
        noShows: tally.noShows,
        wastePlates: wasteOf(tally),
      };
    });
}

export function reportByMeal(
  rows: readonly BookingCount[],
  meals: readonly MealInfo[],
): AdminReport['byMeal'] {
  return meals.map((meal) => {
    const tally = tallyOf(rows.filter((row) => row.mealId === meal.id));
    return {
      mealType: meal.mealType,
      mealName: meal.mealName,
      ...tally,
      total: tallyTotal(tally),
      noShowRatePct: noShowRatePct(tally),
    };
  });
}

/** BR-CAP-1: a date override beats a weekday capacity, which beats the default. */
export function capacityOn(slot: SlotInfo, date: BusinessDate): number {
  const override = slot.dateCapacities.find((entry) => entry.date === date);
  if (override) return override.capacity;
  const weekday = getBusinessWeekday(date);
  return (
    slot.weekdayCapacities.find((entry) => entry.weekday === weekday)?.capacity ??
    slot.defaultCapacity
  );
}

function datesBetween(from: BusinessDate, to: BusinessDate): BusinessDate[] {
  const dates: BusinessDate[] = [];
  for (let date = from; date <= to; date = addBusinessDays(date, 1)) dates.push(date);
  return dates;
}

export interface SlotReportOptions {
  from: BusinessDate;
  to: BusinessDate;
  /** `mealId#date` of meals the mess was closed for: no capacity was on offer. */
  closedMeals: ReadonlySet<string>;
  /** Filtered to one hostel: seats against whole-slot capacity would mean nothing. */
  hideUtilization: boolean;
}

/** Admin §O slot utilization and over-capacity incidents, over the days each slot was open. */
export function reportSlots(
  rows: readonly BookingCount[],
  slots: readonly SlotInfo[],
  options: SlotReportOptions,
): AdminReport['slots'] {
  const dates = datesBetween(options.from, options.to);
  return slots.map((slot) => {
    const openDates = dates.filter((date) => !options.closedMeals.has(`${slot.mealId}#${date}`));
    const entries = rows.filter((row) => row.slotId === slot.slotId);
    const tally = tallyOf(entries);
    const seats = tally.served + tally.noShows + tally.pending;
    const capacity = openDates.reduce((sum, date) => sum + capacityOn(slot, date), 0);
    const overDays = new Set(
      entries.filter((row) => row.isOverCapacity && row.status !== 'CANCELLED').map((r) => r.date),
    );
    return {
      slotId: slot.slotId,
      mealType: slot.mealType,
      label: slot.label,
      startMinute: slot.startMinute,
      averageServedPerDay: openDates.length === 0 ? 0 : Math.round(tally.served / openDates.length),
      utilizationPct:
        options.hideUtilization || capacity === 0 ? null : Math.round((seats / capacity) * 100),
      overCapacityDays: overDays.size,
    };
  });
}

export interface CancelledBooking {
  date: BusinessDate;
  startMinute: number;
  cancelledAt: Date;
}

export function cancellationBucket(leadMinutes: number): CancellationBucket {
  if (leadMinutes < MINUTES_PER_HOUR) return 'UNDER_1_HOUR';
  if (leadMinutes < 6 * MINUTES_PER_HOUR) return 'HOURS_1_TO_6';
  return leadMinutes < 24 * MINUTES_PER_HOUR ? 'HOURS_6_TO_24' : 'OVER_24_HOURS';
}

/** Admin §O lead time: from cancelling to the booked slot's start; staff can cancel after it. */
export function reportCancellations(
  cancelled: readonly CancelledBooking[],
): AdminReport['cancellations'] {
  const leads = cancelled.map((booking) =>
    Math.max(
      0,
      Math.round(
        (toInstant(booking.date, booking.startMinute).getTime() - booking.cancelledAt.getTime()) /
          60_000,
      ),
    ),
  );
  return {
    total: leads.length,
    averageLeadMinutes:
      leads.length === 0
        ? null
        : Math.round(leads.reduce((sum, lead) => sum + lead, 0) / leads.length),
    buckets: CANCELLATION_BUCKETS.map((bucket) => ({
      bucket,
      count: leads.filter((lead) => cancellationBucket(lead) === bucket).length,
    })),
  };
}

export function averageResolutionHours(
  resolved: readonly { createdAt: Date; resolvedAt: Date }[],
): number | null {
  if (resolved.length === 0) return null;
  const total = resolved.reduce(
    (sum, item) => sum + (item.resolvedAt.getTime() - item.createdAt.getTime()),
    0,
  );
  return Math.round(total / resolved.length / 3_600_000);
}
