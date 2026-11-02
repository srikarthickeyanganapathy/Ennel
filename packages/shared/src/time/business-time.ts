import { addMinutes } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { BUSINESS_TIME_ZONE, MINUTES_PER_DAY } from '../constants/time.js';

/** An IST calendar date as `YYYY-MM-DD` (ADR-0002). */
export type BusinessDate = string;

const BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isBusinessDate(value: string): value is BusinessDate {
  if (!BUSINESS_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function assertBusinessDate(value: string): void {
  if (!isBusinessDate(value)) throw new RangeError(`Invalid business date: ${value}`);
}

/**
 * UTC instant for a business date plus minutes since IST midnight (ADR-0002).
 * Minute 1440 is allowed and means midnight at the end of that date. Adding minutes to
 * midnight is exact because Asia/Kolkata has no DST.
 */
export function toInstant(date: BusinessDate, minuteOfDay: number): Date {
  assertBusinessDate(date);
  if (!Number.isInteger(minuteOfDay) || minuteOfDay < 0 || minuteOfDay > MINUTES_PER_DAY) {
    throw new RangeError(`Invalid minute of day: ${minuteOfDay}`);
  }
  const midnight = fromZonedTime(`${date}T00:00:00`, BUSINESS_TIME_ZONE);
  return addMinutes(midnight, minuteOfDay);
}

/** IST calendar date that contains the given instant. */
export function toBusinessDate(instant: Date): BusinessDate {
  return formatInTimeZone(instant, BUSINESS_TIME_ZONE, 'yyyy-MM-dd');
}

/** Minutes since IST midnight for the given instant. */
export function toMinuteOfDay(instant: Date): number {
  const [hours, minutes] = formatInTimeZone(instant, BUSINESS_TIME_ZONE, 'H:m').split(':');
  return Number(hours) * 60 + Number(minutes);
}

/** 0 = Sunday … 6 = Saturday, for an IST calendar date. */
export function getBusinessWeekday(date: BusinessDate): number {
  assertBusinessDate(date);
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function addBusinessDays(date: BusinessDate, days: number): BusinessDate {
  assertBusinessDate(date);
  const base = new Date(`${date}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

/** Formats minutes since midnight as `7:00 AM` (Spec §17: explicit AM/PM). */
export function formatMinuteOfDay(minuteOfDay: number): string {
  const normalized = minuteOfDay % MINUTES_PER_DAY;
  const hours24 = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const period = hours24 < 12 ? 'AM' : 'PM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Thu 21 May 2026", for exported files. */
export function formatBusinessDateLabel(date: BusinessDate): string {
  const [year = '', month = '1', day = '1'] = date.split('-');
  return `${WEEKDAY_NAMES[getBusinessWeekday(date)]} ${Number(day)} ${MONTH_NAMES[Number(month) - 1]} ${year}`;
}
