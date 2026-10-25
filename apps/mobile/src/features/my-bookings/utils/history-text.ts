import { addBusinessDays, type BookingHistoryItem, type BusinessDate } from '@ennel/shared';
import { formatClockTime, formatDateTime } from '@/shared/utils/format-date';
import { ATTENDANCE_SOURCE_TEXT } from '../constants/history-display';

export type RangeChoice = 'RECENT' | 'LAST_7' | 'DATE';

/** RECENT leaves the dates to the server (last 30 days to the end of the booking period). */
export function rangeFor(
  choice: RangeChoice,
  today: BusinessDate,
  date: BusinessDate | null,
): { from?: BusinessDate; to?: BusinessDate } {
  if (choice === 'LAST_7') return { from: addBusinessDays(today, -6), to: today };
  if (choice === 'DATE' && date) return { from: date, to: date };
  return {};
}

/**
 * The one-line outcome under each record (Spec §7). A verification time is shown only when the
 * face-verification system sent one; nothing is ever made up (BR-ATT-1).
 */
export function describeOutcome(item: BookingHistoryItem): string {
  if (item.status === 'COMPLETED') {
    if (item.attendance?.verifiedAt)
      return `Face Verified at ${formatClockTime(item.attendance.verifiedAt)}`;
    return item.attendance ? ATTENDANCE_SOURCE_TEXT[item.attendance.source] : 'Meal completed';
  }
  if (item.status === 'CANCELLED') {
    return item.cancelledAt ? `Cancelled at ${formatDateTime(item.cancelledAt)}` : 'Cancelled';
  }
  if (item.status === 'NO_SHOW') return 'Meal window ended without recorded attendance';
  if (item.status === 'CANCELLED_BY_CLOSURE') return 'Cancelled because the mess was closed';
  return '';
}
