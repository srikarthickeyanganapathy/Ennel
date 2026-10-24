import {
  type BookingSource,
  type BookingStatus,
  type DietType,
  type MealType,
} from '@ennel/shared';
import { type StatusTone } from '@/shared/components/StatusBadge';

/** Status text plus colour (Admin UX standards), matching the student app's wording. */
export const BOOKING_STATUS_DISPLAY: Record<BookingStatus, { label: string; tone: StatusTone }> = {
  BOOKED: { label: 'Booked', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
  COMPLETED: { label: 'Meal completed', tone: 'info' },
  NO_SHOW: { label: 'No-show', tone: 'danger' },
  PAUSED_LEAVE: { label: 'Paused (leave)', tone: 'warning' },
  CANCELLED_BY_CLOSURE: { label: 'Mess closed', tone: 'warning' },
};

export const BOOKING_SOURCE_LABELS: Record<BookingSource, string> = {
  DEFAULT: 'Default Booking',
  MANUAL: 'Student, one day',
  PLAN_AHEAD_DATE: 'Plan Ahead date',
  PLAN_AHEAD_WEEKDAY: 'Weekday rule',
  ADMIN: 'Mess staff',
};

export const MEAL_LABELS: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
};

export const DIET_LABELS: Record<DietType, string> = { VEG: 'Veg', NON_VEG: 'Non-Veg' };
