import { type AttendanceImportRow, type BookingStatus } from '@ennel/shared';

export interface StudentWindowState {
  studentId: string;
  bookingStatus: BookingStatus | null;
  hasAttendance: boolean;
  /** Only set for a No-show booking. */
  noShowStatus: 'COUNTED' | 'HELD_FOR_REVIEW' | 'EXCLUDED' | null;
}

export interface ClassifiedAttendanceRow extends AttendanceImportRow {
  studentId: string | null;
}

/** Same normalisation as the roster import: spaces and dashes are ignored. */
export const normaliseReference = (value: string) => value.replace(/[\s-]/g, '');

/**
 * Admin §I attendance import, validate-first (ADR-0025). A row is VALID only when it would turn a
 * Booked meal into Completed, or clear a No-show held during an outage. A counted No-show is left
 * for No-show review, and a student without a booking needs a manual mark with a reason.
 */
export function classifyAttendanceRows(
  references: readonly string[],
  states: ReadonlyMap<string, StudentWindowState>,
): ClassifiedAttendanceRow[] {
  const seen = new Set<string>();
  return references.map((raw, index) => {
    const referenceNumber = normaliseReference(raw);
    const base = { rowNumber: index + 2, referenceNumber, studentId: null };
    if (referenceNumber === '')
      return { ...base, outcome: 'INVALID', message: 'The reference number is missing.' };
    if (seen.has(referenceNumber)) {
      return {
        ...base,
        outcome: 'DUPLICATE_IN_FILE',
        message: 'This student appears earlier in the file.',
      };
    }
    seen.add(referenceNumber);
    const state = states.get(referenceNumber);
    if (!state)
      return { ...base, outcome: 'INVALID', message: 'No student has this reference number.' };
    return { ...base, studentId: state.studentId, ...classifyState(state) };
  });
}

function classifyState(
  state: StudentWindowState,
): Pick<AttendanceImportRow, 'outcome' | 'message'> {
  if (state.hasAttendance)
    return { outcome: 'EXISTING_UNCHANGED', message: 'Attendance is already recorded.' };
  if (state.bookingStatus === 'BOOKED') return { outcome: 'VALID', message: null };
  if (state.bookingStatus === 'NO_SHOW' && state.noShowStatus === 'HELD_FOR_REVIEW') {
    return { outcome: 'VALID', message: 'Clears a No-show held during the outage.' };
  }
  if (state.bookingStatus === 'NO_SHOW') {
    return {
      outcome: 'INVALID',
      message: 'Already a counted No-show. Correct it through No-show review.',
    };
  }
  if (state.bookingStatus === null) {
    return {
      outcome: 'INVALID',
      message: 'No booking for this meal. Mark it at the counter with a reason.',
    };
  }
  return {
    outcome: 'INVALID',
    message: 'This meal was not booked (cancelled, leave or mess closed).',
  };
}
