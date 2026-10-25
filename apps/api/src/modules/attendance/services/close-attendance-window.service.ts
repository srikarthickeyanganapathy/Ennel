import { Injectable } from '@nestjs/common';
import { type BusinessDate } from '@ennel/shared';
import { Clock } from '../../../infrastructure/clock/clock';
import {
  type TransactionClient,
  TransactionRunner,
} from '../../../infrastructure/database/transaction-runner';
import { BookingOutcomeService } from '../../bookings/services/booking-outcome.service';
import { planWindowClose } from '../domain/attendance-rules';
import { attendanceWindow, overlapsOutage } from '../domain/attendance-window';
import { AttendanceProvider } from '../provider/attendance-provider';
import { AttendanceRepository, type MealWithSlots } from '../repositories/attendance.repository';
import { AttendanceRecorder } from './attendance-recorder.service';

export interface WindowCloseStats {
  verified: number;
  completed: number;
  noShows: number;
  heldForReview: number;
}

/** One meal can have a few thousand bookings; well above Prisma's 5-second default. */
const CLOSE_TIMEOUT_MS = 120_000;

/**
 * BR-NS-1, BR-NS-7: finalises one closed meal window. Face verifications are pulled first, then
 * every still-Booked meal becomes Completed or a No-show (held for review after an outage). No
 * thresholds or warnings yet; those belong to the no-show engine (Phase 9).
 */
@Injectable()
export class CloseAttendanceWindowService {
  constructor(
    private readonly attendance: AttendanceRepository,
    private readonly recorder: AttendanceRecorder,
    private readonly outcomes: BookingOutcomeService,
    private readonly provider: AttendanceProvider,
    private readonly transactions: TransactionRunner,
    private readonly clock: Clock,
  ) {}

  async close(date: BusinessDate, meal: MealWithSlots): Promise<WindowCloseStats> {
    const verifications = await this.provider.fetchVerifications(date, meal.mealType);
    return this.transactions.run(
      async (tx) => {
        const verified = await this.recordVerifications(date, meal, verifications, tx);
        const window = attendanceWindow(date, meal);
        const outages = await this.attendance.outagesBetween(window.opensAt, window.closesAt, tx);
        const bookings = await this.attendance.windowBookings(date, meal.id, tx);
        const stats: WindowCloseStats = { verified, completed: 0, noShows: 0, heldForReview: 0 };
        const byId = new Map(bookings.map((booking) => [booking.id, booking]));
        for (const action of planWindowClose(bookings, overlapsOutage(window, outages))) {
          const booking = byId.get(action.bookingId);
          if (!booking) continue;
          const ref = { id: booking.id, version: booking.version, status: 'BOOKED' as const };
          if (action.kind === 'COMPLETE') {
            if (await this.outcomes.complete(ref, { type: 'SYSTEM' }, tx)) stats.completed += 1;
            continue;
          }
          if (!(await this.outcomes.markNoShow(ref, tx))) continue;
          await this.attendance.createNoShowEvent(
            {
              bookingId: booking.id,
              studentId: booking.studentId,
              date,
              mealType: meal.mealType,
              status: action.noShowStatus,
            },
            tx,
          );
          if (action.noShowStatus === 'HELD_FOR_REVIEW') stats.heldForReview += 1;
          else stats.noShows += 1;
        }
        return stats;
      },
      { timeoutMs: CLOSE_TIMEOUT_MS },
    );
  }

  private async recordVerifications(
    date: BusinessDate,
    meal: MealWithSlots,
    verifications: { referenceNumber: string; verifiedAt: Date }[],
    tx: TransactionClient,
  ): Promise<number> {
    if (verifications.length === 0) return 0;
    const students = await this.attendance.studentIdsByReference(
      verifications.map((item) => item.referenceNumber),
      tx,
    );
    const bookings = await this.attendance.windowBookings(date, meal.id, tx);
    const recordedAt = this.clock.now();
    let count = 0;
    for (const verification of verifications) {
      const studentId = students.get(verification.referenceNumber);
      if (!studentId) continue;
      const outcome = await this.recorder.record(
        {
          studentId,
          date,
          mealId: meal.id,
          booking: bookings.find((booking) => booking.studentId === studentId) ?? null,
          source: 'FACE_VERIFICATION',
          verifiedAt: verification.verifiedAt,
          recordedAt,
          actor: { type: 'SYSTEM' },
        },
        tx,
      );
      if (outcome === 'RECORDED') count += 1;
    }
    return count;
  }
}
