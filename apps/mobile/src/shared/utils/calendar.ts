import { type BusinessDate } from '@ennel/shared';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Column headings, Sunday first like the grid. */
export const CALENDAR_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export interface CalendarBounds {
  /** First and last dates that can be chosen. */
  firstDate: BusinessDate;
  lastDate: BusinessDate;
  today: BusinessDate;
}

export interface CalendarCell {
  date: BusinessDate;
  dayOfMonth: number;
  isSelectable: boolean;
  isToday: boolean;
}

/** `YYYY-MM` of a business date. */
export const monthOf = (date: BusinessDate) => date.slice(0, 7);

/** The month before or after `YYYY-MM`. */
export function shiftMonth(month: string, delta: number): string {
  const [year = 0, monthNumber = 1] = month.split('-').map(Number);
  const index = year * 12 + (monthNumber - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export function monthTitle(month: string): string {
  const [year, monthNumber = 1] = month.split('-').map(Number);
  return `${MONTH_NAMES[monthNumber - 1]} ${year}`;
}

/**
 * Weeks (Sunday first) for a month grid; days outside the month are null. Business dates are
 * calendar dates, so the arithmetic is done in UTC without any time zone shift (ADR-0002).
 */
export function buildMonth(month: string, bounds: CalendarBounds): (CalendarCell | null)[][] {
  const [year = 0, monthNumber = 1] = month.split('-').map(Number);
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const cells: (CalendarCell | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    cells.push({
      date,
      dayOfMonth: day,
      isSelectable: date >= bounds.firstDate && date <= bounds.lastDate,
      isToday: date === bounds.today,
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}
