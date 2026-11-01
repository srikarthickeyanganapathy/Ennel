import { BUSINESS_TIME_ZONE, formatMinuteOfDay } from '@ennel/shared';
import { formatInTimeZone } from 'date-fns-tz';

/** Admin UX standard: IST times with AM/PM. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return formatInTimeZone(new Date(iso), BUSINESS_TIME_ZONE, 'd MMM yyyy, h:mm a');
}

export function formatTime(iso: string): string {
  return formatInTimeZone(new Date(iso), BUSINESS_TIME_ZONE, 'h:mm a');
}

/** Business dates are calendar dates (ADR-0002), so they are formatted without a time zone shift. */
export function formatBusinessDate(
  date: string | null | undefined,
  pattern = 'EEE, d MMM yyyy',
): string {
  if (!date) return '—';
  return formatInTimeZone(new Date(`${date}T00:00:00Z`), 'UTC', pattern);
}

export function formatMinutes(minute: number): string {
  return formatMinuteOfDay(minute);
}

/** "HH:mm" for <input type="time">, and back. */
export function minuteToTimeInput(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

export function timeInputToMinute(value: string): number {
  const [hours = '0', minutes = '0'] = value.split(':');
  return Number(hours) * 60 + Number(minutes);
}

export function todayBusinessDate(): string {
  return formatInTimeZone(new Date(), BUSINESS_TIME_ZONE, 'yyyy-MM-dd');
}

/** Monday of the week containing the date (menu editor weeks start on Monday). */
export function startOfWeek(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  const offset = (value.getUTCDay() + 6) % 7;
  value.setUTCDate(value.getUTCDate() - offset);
  return value.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
