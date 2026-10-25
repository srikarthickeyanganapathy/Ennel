import {
  comparePoints,
  countRange,
  isRangeOrdered,
  LEAVE_MAX_DAYS,
  type LeaveState,
  type LeaveStatus,
  type MealPoint,
  type MealRange,
  rangeEnd,
  rangesOverlap,
  rangeStart,
} from '@ennel/shared';

/** One upcoming meal and the moment after which it can no longer be skipped by leave. */
export interface MealOccurrence {
  point: MealPoint;
  /**
   * ADR-0026: the cancellation deadline of the student's booked slot, or the meal's start when
   * nothing is booked (staff use the slot or meal start).
   */
  cutoffAt: Date;
  serviceEndAt: Date;
}

export interface StoredLeave {
  id: string;
  status: LeaveStatus;
  range: MealRange;
}

/**
 * ADR-0026, BR-LEAVE-7: the first meal a leave may start at, or a student may resume from: the
 * first one whose cut-off has not passed. Occurrences are in meal order.
 */
export function earliestChangePoint(occurrences: readonly MealOccurrence[], now: Date): MealPoint {
  const open = occurrences.find((meal) => meal.cutoffAt > now);
  if (open) return open.point;
  const last = occurrences.at(-1);
  if (!last) throw new Error('No meal occurrences to choose from');
  return last.point;
}

/** The meal being served now, or the next one: what "On Leave" is measured against. */
export function currentPoint(occurrences: readonly MealOccurrence[], now: Date): MealPoint {
  const current = occurrences.find((meal) => meal.serviceEndAt > now) ?? occurrences.at(-1);
  if (!current) throw new Error('No meal occurrences to choose from');
  return current.point;
}

/** BR-LEAVE-5: Upcoming / On Leave / Ended are derived; only the status is stored. */
export function deriveLeaveState(leave: StoredLeave, current: MealPoint): LeaveState {
  if (leave.status !== 'APPROVED') return leave.status;
  if (comparePoints(rangeEnd(leave.range), current) < 0) return 'ENDED';
  return comparePoints(rangeStart(leave.range), current) > 0 ? 'UPCOMING' : 'ON_LEAVE';
}

export type CurrentLeaveStatus = 'NOT_ON_LEAVE' | 'UPCOMING' | 'ON_LEAVE' | 'PENDING';

/** Spec §11.2 "Current Leave Status": On Leave beats Upcoming, which beats Pending. */
export function currentLeaveStatus(
  leaves: readonly StoredLeave[],
  current: MealPoint,
): { status: CurrentLeaveStatus; leaveId: string | null } {
  const byStart = [...leaves].sort((a, b) =>
    comparePoints(rangeStart(a.range), rangeStart(b.range)),
  );
  for (const status of ['ON_LEAVE', 'UPCOMING', 'PENDING'] as const) {
    const match = byStart.find((leave) => deriveLeaveState(leave, current) === status);
    if (match) return { status, leaveId: match.id };
  }
  return { status: 'NOT_ON_LEAVE', leaveId: null };
}

export type RangeProblem = { code: 'LEAVE_RANGE_INVALID'; message: string } | null;

const invalid = (message: string): RangeProblem => ({ code: 'LEAVE_RANGE_INVALID', message });

/**
 * BR-LEAVE-2, ADR-0026: the end may not precede the start, the start may not be before the
 * earliest allowed meal, and the leave may not share a meal with another pending or approved
 * leave of the same student.
 */
export function checkLeaveRange(
  range: MealRange,
  earliest: MealPoint,
  others: readonly StoredLeave[],
): RangeProblem {
  if (!isRangeOrdered(range)) return invalid('The end must be on or after the start.');
  if (comparePoints(rangeStart(range), earliest) < 0) {
    return invalid('Leave can only start at a meal that can still be cancelled.');
  }
  if (countRange(range).days > LEAVE_MAX_DAYS) {
    return invalid(`A leave can cover at most ${LEAVE_MAX_DAYS} days.`);
  }
  const clash = others.find(
    (other) =>
      (other.status === 'PENDING' || other.status === 'APPROVED') &&
      rangesOverlap(other.range, range),
  );
  return clash
    ? invalid('This overlaps another leave. Extend or change that leave instead.')
    : null;
}
