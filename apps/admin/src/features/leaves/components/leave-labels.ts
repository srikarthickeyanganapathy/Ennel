import { type LeaveRange, type LeaveState, type MealType } from '@ennel/shared';
import { type StatusTone } from '@/shared/components/StatusBadge';
import { formatBusinessDate } from '@/shared/lib/format';

export const MEAL_NAMES: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
};

/** Text plus colour for each derived state (Admin UX standards). */
export const STATE_DISPLAY: Record<LeaveState, { label: string; tone: StatusTone }> = {
  PENDING: { label: 'Pending approval', tone: 'warning' },
  UPCOMING: { label: 'Upcoming', tone: 'info' },
  ON_LEAVE: { label: 'On leave', tone: 'success' },
  ENDED: { label: 'Ended', tone: 'neutral' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};

export function describeRange(range: LeaveRange): string {
  return `${formatBusinessDate(range.startDate, 'EEE d MMM')} ${MEAL_NAMES[range.startMealType]} → ${formatBusinessDate(range.endDate, 'EEE d MMM')} ${MEAL_NAMES[range.endMealType]}`;
}
