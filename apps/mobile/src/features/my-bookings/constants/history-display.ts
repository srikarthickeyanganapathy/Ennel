import {
  type AttendanceSource,
  type BookingSource,
  type BookingStatus,
  type HistoryStatusFilter,
} from '@ennel/shared';

interface StatusDisplay {
  text: string;
  /** Text plus colour, never colour alone (Spec §14). */
  badgeClassName: string;
}

const NEUTRAL = 'bg-surface text-muted-foreground';
const SUCCESS = 'bg-success-surface text-success';
const WARNING = 'bg-warning-surface text-warning';
const DANGER = 'bg-danger-surface text-danger';
const INFO = 'bg-info-surface text-info';

/** Spec §7 final statuses (the others never appear in history). */
export const HISTORY_STATUS_DISPLAY: Record<BookingStatus, StatusDisplay> = {
  COMPLETED: { text: 'Meal Completed', badgeClassName: SUCCESS },
  NO_SHOW: { text: 'No-show', badgeClassName: DANGER },
  CANCELLED: { text: 'Cancelled', badgeClassName: NEUTRAL },
  CANCELLED_BY_CLOSURE: { text: 'Mess Closed', badgeClassName: WARNING },
  BOOKED: { text: 'Booked', badgeClassName: INFO },
  PAUSED_LEAVE: { text: 'Paused — On Leave', badgeClassName: WARNING },
};

export const STATUS_FILTER_LABELS: Record<HistoryStatusFilter, string> = {
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No-show',
};

/** Spec §7 "booking source (default/manual/Plan Ahead)". */
export const SOURCE_TEXT: Record<BookingSource, string> = {
  DEFAULT: 'Default Booking',
  MANUAL: 'Booked by you',
  PLAN_AHEAD_DATE: 'Plan Ahead (one date)',
  PLAN_AHEAD_WEEKDAY: 'Plan Ahead (weekday rule)',
  ADMIN: 'Booked by mess staff',
};

export const ATTENDANCE_SOURCE_TEXT: Record<AttendanceSource, string> = {
  FACE_VERIFICATION: 'Face Verified',
  MANUAL_FALLBACK: 'Marked at the counter by mess staff',
  IMPORT: 'Recorded from the attendance file',
};
