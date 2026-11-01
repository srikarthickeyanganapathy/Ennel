import { addBusinessDays, type BusinessDate } from '@ennel/shared';

export interface LeaveDays {
  studentId: string;
  startDate: BusinessDate;
  endDate: BusinessDate;
}

/** First and last day of a `YYYY-MM` month. */
export function monthBounds(month: string): { first: BusinessDate; last: BusinessDate } {
  const [year = 0, monthNumber = 1] = month.split('-').map(Number);
  const first = `${month}-01`;
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { first, last: `${month}-${String(days).padStart(2, '0')}` };
}

/**
 * Admin §K "students away" calendar: for each day of the month, how many students have approved
 * leave covering at least one meal of it. A student with two leaves on one day counts once.
 */
export function dailyLeaveCounts(
  leaves: readonly LeaveDays[],
  first: BusinessDate,
  last: BusinessDate,
): { date: BusinessDate; count: number }[] {
  const days: { date: BusinessDate; count: number }[] = [];
  for (let date = first; date <= last; date = addBusinessDays(date, 1)) {
    const away = new Set(
      leaves
        .filter((leave) => leave.startDate <= date && leave.endDate >= date)
        .map((leave) => leave.studentId),
    );
    days.push({ date, count: away.size });
  }
  return days;
}
