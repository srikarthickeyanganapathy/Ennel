import { type BookingStatus } from '@ennel/shared';
import { type WindowPhase } from './attendance-window';

export interface WindowBooking {
  id: string;
  status: BookingStatus;
  hasAttendance: boolean;
}

export type CloseAction =
  | { bookingId: string; kind: 'COMPLETE' }
  | { bookingId: string; kind: 'NO_SHOW'; noShowStatus: 'COUNTED' | 'HELD_FOR_REVIEW' };

/**
 * BR-NS-1, BR-NS-2, BR-NS-7: when a window closes, every still-Booked meal becomes Completed (it
 * has attendance) or a No-show. Cancelled, leave and closure meals are never touched, and an
 * outage during the window holds the No-show for review instead of counting it.
 */
export function planWindowClose(
  bookings: readonly WindowBooking[],
  hadOutage: boolean,
): CloseAction[] {
  return bookings
    .filter((booking) => booking.status === 'BOOKED')
    .map((booking) =>
      booking.hasAttendance
        ? { bookingId: booking.id, kind: 'COMPLETE' as const }
        : {
            bookingId: booking.id,
            kind: 'NO_SHOW' as const,
            noShowStatus: hadOutage ? ('HELD_FOR_REVIEW' as const) : ('COUNTED' as const),
          },
    );
}

export type MarkDecision =
  | { canMark: true; needsReason: boolean; note: string | null }
  | { canMark: false; needsReason: false; note: string };

/**
 * BR-ATT-2 (ADR-0025): staff may mark a student present only while the window is open, once,
 * and only with a Booked meal, unless they give a reason for a student without a booking.
 */
export function decideManualMark(input: {
  phase: WindowPhase;
  bookingStatus: BookingStatus | null;
  hasAttendance: boolean;
}): MarkDecision {
  if (input.hasAttendance) {
    return { canMark: false, needsReason: false, note: 'Attendance is already recorded.' };
  }
  if (input.phase === 'BEFORE') {
    return { canMark: false, needsReason: false, note: 'This meal has not started yet.' };
  }
  if (input.phase === 'CLOSED') {
    return {
      canMark: false,
      needsReason: false,
      note: 'The attendance window has closed. Corrections go through No-show review.',
    };
  }
  if (input.bookingStatus === 'BOOKED') return { canMark: true, needsReason: false, note: null };
  if (input.bookingStatus === null) {
    return {
      canMark: true,
      needsReason: true,
      note: 'No booking for this meal. Give a reason to record attendance anyway.',
    };
  }
  return {
    canMark: false,
    needsReason: false,
    note: `This meal is not booked (${BLOCKED_STATUS_TEXT[input.bookingStatus] ?? 'not available'}).`,
  };
}

const BLOCKED_STATUS_TEXT: Partial<Record<BookingStatus, string>> = {
  CANCELLED: 'cancelled',
  PAUSED_LEAVE: 'on leave',
  CANCELLED_BY_CLOSURE: 'mess closed',
  COMPLETED: 'already completed',
  NO_SHOW: 'marked No-show',
};
