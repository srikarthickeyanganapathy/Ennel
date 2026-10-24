import { type BookingLabel, type DietType, type MealType } from '@ennel/shared';

interface LabelDisplay {
  text: string;
  /** Always text plus colour, never colour alone (Spec §14). */
  badgeClassName: string;
}

const NEUTRAL = 'bg-surface text-muted-foreground';
const SUCCESS = 'bg-success-surface text-success';
const INFO = 'bg-info-surface text-info';
const WARNING = 'bg-warning-surface text-warning';
const DANGER = 'bg-danger-surface text-danger';

/** BR-BOOK-3 wording (Spec §4.3). */
export const BOOKING_LABEL_DISPLAY: Record<BookingLabel, LabelDisplay> = {
  NOT_BOOKED_DEFAULT_OFF: { text: 'Not Booked — Default Off', badgeClassName: NEUTRAL },
  NOT_BOOKED: { text: 'Not Booked', badgeClassName: NEUTRAL },
  BOOKED_DEFAULT: { text: 'Booked (Default)', badgeClassName: SUCCESS },
  BOOKED_WEEKDAY_RULE: { text: 'Booked (Weekday Rule)', badgeClassName: SUCCESS },
  BOOKED_ONCE: { text: 'Booked Once', badgeClassName: SUCCESS },
  CHANGED_FOR_THIS_DAY: { text: 'Changed for This Day', badgeClassName: INFO },
  CANCELLED: { text: 'Cancelled', badgeClassName: DANGER },
  PAUSED_LEAVE: { text: 'Booking Paused — On Leave', badgeClassName: WARNING },
  MESS_CLOSED: { text: 'Mess Closed', badgeClassName: WARNING },
  NO_SHOW: { text: 'No-show', badgeClassName: DANGER },
  COMPLETED: { text: 'Meal Completed', badgeClassName: SUCCESS },
};

/** Spec wording: "Meal type: Veg / Non-Veg" (BR-MEAL-2). */
export const DIET_LABELS: Record<DietType, string> = { VEG: 'Veg', NON_VEG: 'Non-Veg' };

export const MEAL_LABELS: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
};
