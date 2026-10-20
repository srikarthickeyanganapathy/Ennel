import { formatMinuteOfDay, MealType, type SlotUsage } from '@ennel/shared';

export interface TimeWindow {
  startMinute: number;
  endMinute: number;
}

/** Default slot label in the student app's AM/PM style (Spec §5.1). */
export function buildSlotLabel(window: TimeWindow): string {
  return `${formatMinuteOfDay(window.startMinute)} - ${formatMinuteOfDay(window.endMinute)}`;
}

/**
 * Data-integrity rules for slots (BR-MEAL-4): a slot ends after it starts, lies inside its
 * meal's serving window, and does not overlap another active slot of the same meal.
 */
export function findSlotWindowProblem(
  slot: TimeWindow,
  meal: TimeWindow,
  otherActiveSlots: TimeWindow[],
): string | null {
  if (slot.endMinute <= slot.startMinute) return 'The slot must end after it starts';
  if (slot.startMinute < meal.startMinute || slot.endMinute > meal.endMinute) {
    return `The slot must fall within the serving window (${buildSlotLabel(meal)})`;
  }
  const overlap = otherActiveSlots.find(
    (other) => slot.startMinute < other.endMinute && other.startMinute < slot.endMinute,
  );
  return overlap ? `The slot overlaps ${buildSlotLabel(overlap)}` : null;
}

/** A serving window must still contain every active slot after it is edited. */
export function findMealWindowProblem(meal: TimeWindow, activeSlots: TimeWindow[]): string | null {
  if (meal.endMinute <= meal.startMinute) return 'The serving window must end after it starts';
  const outside = activeSlots.find(
    (slot) => slot.startMinute < meal.startMinute || slot.endMinute > meal.endMinute,
  );
  return outside ? `The slot ${buildSlotLabel(outside)} would fall outside the new window` : null;
}

/** Breakfast is one serving window (BR-MEAL-1), so it never gets extra slots. */
export function canAddSlot(mealType: MealType): boolean {
  return mealType !== MealType.BREAKFAST;
}

export function isSlotInUse(usage: SlotUsage): boolean {
  return usage.futureBookings + usage.preferences + usage.weekdayRules + usage.dateExceptions > 0;
}
