import { type LeaveRange, type LeaveState, type MealPoint } from '@ennel/shared';
import { formatBusinessDate } from '@/shared/utils/format-date';
import { MEAL_LABELS } from '@/features/bookings/constants/booking-labels';

interface StateDisplay {
  text: string;
  /** Text plus colour, never colour alone (Spec §14). */
  badgeClassName: string;
}

const SUCCESS = 'bg-success-surface text-success';
const WARNING = 'bg-warning-surface text-warning';
const INFO = 'bg-info-surface text-info';
const NEUTRAL = 'bg-surface text-muted-foreground';
const DANGER = 'bg-danger-surface text-danger';

/** Spec §11.2 statuses. */
export const LEAVE_STATE_DISPLAY: Record<LeaveState, StateDisplay> = {
  PENDING: { text: 'Pending approval', badgeClassName: WARNING },
  UPCOMING: { text: 'Upcoming Leave', badgeClassName: INFO },
  ON_LEAVE: { text: 'On Leave', badgeClassName: SUCCESS },
  ENDED: { text: 'Ended', badgeClassName: NEUTRAL },
  REJECTED: { text: 'Not approved', badgeClassName: DANGER },
  CANCELLED: { text: 'Cancelled', badgeClassName: NEUTRAL },
};

/** `Fri, 22 May, Breakfast`. */
export function describePoint(point: MealPoint): string {
  return `${formatBusinessDate(point.date)}, ${MEAL_LABELS[point.mealType]}`;
}

/** `Fri, 22 May, Breakfast → Sun, 31 May, Dinner`. */
export function describeRange(range: LeaveRange): string {
  return `${describePoint({ date: range.startDate, mealType: range.startMealType })} → ${describePoint({ date: range.endDate, mealType: range.endMealType })}`;
}

/** Spec §11.1 summary line, e.g. "10 days, 30 meals skipped". */
export function describeCount(days: number, meals: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'}, ${meals} ${meals === 1 ? 'meal' : 'meals'} skipped`;
}
