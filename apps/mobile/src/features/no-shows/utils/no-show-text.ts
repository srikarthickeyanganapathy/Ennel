import { type MealNoShowSummary, type NoShowSummary, type StudentNoShowEvent } from '@ennel/shared';

/** Spec §10 Home warning text for one meal, or null when nothing needs saying. */
export function warningText(meal: MealNoShowSummary, summary: NoShowSummary): string | null {
  const days = summary.windowDays;
  if (meal.isAutoDisabled) {
    return meal.canReEnable
      ? `Default Booking for ${meal.mealName} is off after No-shows. You can switch it back on in Default Booking.`
      : `Default Booking for ${meal.mealName} is off: ${meal.count} No-shows in ${days} days. You can still book ${meal.mealName.toLowerCase()} yourself.`;
  }
  if (meal.level !== 'WARNING') return null;
  const more = meal.remainingBeforeDisable;
  return `${meal.count} No-shows for ${meal.mealName} in ${days} days. ${more} more will turn off Default Booking for ${meal.mealName}.`;
}

/** BR-NS-4: the first warning can be dismissed; from the next No-show it stays. */
export function isDismissible(meal: MealNoShowSummary, summary: NoShowSummary): boolean {
  return !meal.isAutoDisabled && meal.count === summary.warningThreshold;
}

/** What happened to a No-show and its report, in the student's words. */
export function eventStatusText(event: StudentNoShowEvent): string {
  if (event.status === 'EXCLUDED') {
    return event.exclusionCause === 'APPEAL_APPROVED'
      ? 'Removed after your report was approved'
      : 'Removed by the mess office; it does not count';
  }
  if (event.status === 'HELD_FOR_REVIEW') return 'Under review: the attendance system was down';
  if (event.appeal?.status === 'PENDING') return 'Counts for now; your report is being reviewed';
  if (event.appeal?.status === 'REJECTED') {
    return `Report not approved${event.appeal.decisionReason ? `: ${event.appeal.decisionReason}` : ''}`;
  }
  return 'Counts towards your No-shows';
}
