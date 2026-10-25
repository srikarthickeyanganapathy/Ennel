import { Injectable } from '@nestjs/common';
import { type AttendanceSource, type BusinessDate } from '@ennel/shared';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';
import {
  BookingOutcomeService,
  type OutcomeActor,
} from '../../bookings/services/booking-outcome.service';
import { AttendanceRepository, type WindowBookingRow } from '../repositories/attendance.repository';

export interface RecordAttendanceInput {
  studentId: string;
  date: BusinessDate;
  mealId: string;
  /** The student's booking for this meal, if any. */
  booking: WindowBookingRow | null;
  source: AttendanceSource;
  /** Only for FACE_VERIFICATION (BR-ATT-1); null for manual and imported records. */
  verifiedAt: Date | null;
  recordedAt: Date;
  actor: OutcomeActor;
  importJobId?: string;
  outageWindowId?: string | null;
}

export type RecordOutcome = 'RECORDED' | 'ALREADY_RECORDED';

/**
 * The one way attendance is written (manual marks, imports, the provider). One record per
 * student and meal; recording it completes a Booked meal at once (ADR-0025), so Home and
 * My Bookings show "Meal Completed" without waiting for the window to close.
 */
@Injectable()
export class AttendanceRecorder {
  constructor(
    private readonly attendance: AttendanceRepository,
    private readonly outcomes: BookingOutcomeService,
  ) {}

  async record(input: RecordAttendanceInput, tx: TransactionClient): Promise<RecordOutcome> {
    const isCreated = await this.attendance.createRecord(
      {
        studentId: input.studentId,
        bookingId: input.booking?.id ?? null,
        date: input.date,
        mealId: input.mealId,
        source: input.source,
        verifiedAt: input.source === 'FACE_VERIFICATION' ? input.verifiedAt : null,
        recordedAt: input.recordedAt,
        recordedById: input.actor.type === 'STAFF' ? input.actor.staffId : null,
        importJobId: input.importJobId ?? null,
        outageWindowId: input.outageWindowId ?? null,
      },
      tx,
    );
    if (!isCreated) return 'ALREADY_RECORDED';
    if (input.booking?.status === 'BOOKED') {
      await this.outcomes.complete(
        { id: input.booking.id, version: input.booking.version, status: 'BOOKED' },
        input.actor,
        tx,
      );
    }
    return 'RECORDED';
  }
}
