import { type AttendanceSource, type BookingStatus, type MealType } from '@ennel/shared';

export const MEAL_NAMES: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
};

export const SOURCE_TEXT: Record<AttendanceSource, string> = {
  FACE_VERIFICATION: 'Face verified',
  MANUAL_FALLBACK: 'Marked at the counter',
  IMPORT: 'Imported',
};

export const BOOKING_STATUS_TEXT: Record<BookingStatus, string> = {
  BOOKED: 'Booked',
  COMPLETED: 'Meal completed',
  NO_SHOW: 'No-show',
  CANCELLED: 'Cancelled',
  PAUSED_LEAVE: 'On leave',
  CANCELLED_BY_CLOSURE: 'Mess closed',
};

export const PHASE_TEXT = {
  BEFORE: 'Not started',
  OPEN: 'Open for attendance',
  CLOSED: 'Window closed',
} as const;
