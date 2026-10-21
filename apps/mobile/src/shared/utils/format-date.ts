import { type BusinessDate, getBusinessWeekday } from '@ennel/shared';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2026-10-22` → `Thu, 22 Oct`. Business dates are IST calendar dates (ADR-0002). */
export function formatBusinessDate(date: BusinessDate): string {
  const [, month, day] = date.split('-').map(Number);
  return `${WEEKDAYS[getBusinessWeekday(date)]}, ${day} ${MONTHS[(month ?? 1) - 1]}`;
}

/** "Today", "Tomorrow" or the formatted date, so a future date is never mistaken for today (Spec §4.2). */
export function describeBusinessDate(
  date: BusinessDate,
  today: BusinessDate,
  tomorrow: BusinessDate,
): string {
  if (date === today) return `Today, ${formatBusinessDate(date)}`;
  if (date === tomorrow) return `Tomorrow, ${formatBusinessDate(date)}`;
  return formatBusinessDate(date);
}
