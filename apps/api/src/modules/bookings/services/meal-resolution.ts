import { type BusinessDate } from '@ennel/shared';
import { isMealCoveredByLeave } from '../domain/leave-coverage';
import {
  type DefaultIntent,
  type Resolution,
  resolveEffectiveBooking,
  resolveRecurring,
} from '../domain/resolve-effective-booking';
import { type MealDayRow, type StudentDay } from '../repositories/bookings.repository';

export interface MealResolution {
  isClosed: boolean;
  isOnLeave: boolean;
  defaultIntent: DefaultIntent;
  /** Everything applied (BR-BOOK-4). */
  resolution: Resolution;
  /** Weekday rule, then Default Booking only. */
  recurring: Resolution;
}

/**
 * Feeds one meal's loaded intent into the resolver. Shared by the Home cards, Default Booking
 * generation and closure restoration, so they can never disagree.
 */
export function resolveMeal(meal: MealDayRow, day: StudentDay, date: BusinessDate): MealResolution {
  const isOnLeave = day.leaves.some((leave) => isMealCoveredByLeave(leave, date, meal.mealType));
  const isClosed = meal.closureTitle !== null;
  const defaultIntent: DefaultIntent = {
    isOverallEnabled: day.defaultBookingEnabled,
    isMealEnabled: meal.preference?.isEnabled ?? false,
    isAutoDisabled: meal.preference?.isAutoDisabled ?? false,
    slotId: meal.preference?.slotId ?? undefined,
    dietType: meal.preference?.dietType,
  };
  return {
    isClosed,
    isOnLeave,
    defaultIntent,
    resolution: resolveEffectiveBooking({
      isClosed,
      isOnApprovedLeave: isOnLeave,
      dateException: meal.dateException,
      weekdayRule: meal.weekdayRule,
      defaultIntent,
    }),
    recurring: resolveRecurring(meal.weekdayRule, defaultIntent),
  };
}
