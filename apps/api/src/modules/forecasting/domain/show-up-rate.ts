/** One past day of one meal. */
export interface MealDayHistory {
  /** Seats taken that day (booked, completed or no-show). */
  booked: number;
  /** Attendance records for booked students. */
  attended: number;
  /**
   * True once attendance was processed for the day (any attendance record or no-show).
   * Days without it are skipped, so a missing attendance feed never reads as 0% show-up.
   */
  hasAttendanceData: boolean;
}

export interface ShowUpEstimate {
  /** 0–1 */
  rate: number;
  daysUsed: number;
  isLowConfidence: boolean;
}

/** BR-FC-1: below this many days of history the forecast is flagged low-confidence. */
export const MIN_CONFIDENT_DAYS = 7;

/**
 * BR-FC-1 show-up rate: the average of attended ÷ booked over the most recent `lookbackDays`
 * days with data (history must be newest first). With no usable day the rate is 1.0.
 */
export function estimateShowUpRate(
  history: readonly MealDayHistory[],
  lookbackDays: number,
): ShowUpEstimate {
  const usable = history
    .filter((day) => day.hasAttendanceData && day.booked > 0)
    .slice(0, lookbackDays);
  if (usable.length === 0) return { rate: 1, daysUsed: 0, isLowConfidence: true };
  const total = usable.reduce((sum, day) => sum + Math.min(1, day.attended / day.booked), 0);
  return {
    // Four decimals: enough precision, and 0.8 stays 0.8 instead of 0.7999…
    rate: Math.round((total / usable.length) * 10_000) / 10_000,
    daysUsed: usable.length,
    isLowConfidence: usable.length < MIN_CONFIDENT_DAYS,
  };
}

/** BR-FC-1 expected plates, rounded up so the kitchen never plans one plate short. */
export function expectedPlates(booked: number, estimate: ShowUpEstimate): number {
  return Math.ceil(booked * estimate.rate);
}
