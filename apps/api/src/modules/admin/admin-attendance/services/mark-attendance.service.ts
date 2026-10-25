import { Injectable } from '@nestjs/common';
import { type AttendanceLookup, ErrorCode, type markAttendanceRequestSchema } from '@ennel/shared';
import { type z } from 'zod';
import { AppError } from '../../../../common/errors/app-error';
import { Clock } from '../../../../infrastructure/clock/clock';
import { TransactionRunner } from '../../../../infrastructure/database/transaction-runner';
import { AttendanceRecorder } from '../../../attendance/services/attendance-recorder.service';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { AdminAttendanceRepository } from '../repositories/admin-attendance.repository';
import { AttendanceCounterService } from './attendance-counter.service';

type MarkRequest = z.output<typeof markAttendanceRequestSchema>;

/**
 * Admin §I "mark present", BR-ATT-2: allowed while the window is open, recorded as
 * MANUAL_FALLBACK (linked to the outage window when outage mode is on), and audited. A student
 * without a booking needs a reason.
 */
@Injectable()
export class MarkAttendanceService {
  constructor(
    private readonly counter: AttendanceCounterService,
    private readonly admin: AdminAttendanceRepository,
    private readonly recorder: AttendanceRecorder,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly clock: Clock,
  ) {}

  async execute(staffId: string, request: MarkRequest): Promise<AttendanceLookup> {
    await this.transactions.run(async (tx) => {
      const before = await this.counter.lookup(request, tx);
      if (!before.canMark) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, before.note ?? 'Cannot mark attendance.');
      }
      if (before.needsReason && !request.reason) {
        throw new AppError(
          ErrorCode.OVERRIDE_REASON_REQUIRED,
          'Give a reason to record attendance for a student without a booking.',
        );
      }
      const meal = await this.counter.meal(request.mealType, tx);
      const booking = await this.admin.bookingAtCounter(
        before.student.id,
        request.date,
        meal.id,
        tx,
      );
      const outage = await this.admin.activeOutage(tx);
      const outcome = await this.recorder.record(
        {
          studentId: before.student.id,
          date: request.date,
          mealId: meal.id,
          booking,
          source: 'MANUAL_FALLBACK',
          verifiedAt: null,
          recordedAt: this.clock.now(),
          actor: { type: 'STAFF', staffId },
          outageWindowId: outage?.id ?? null,
        },
        tx,
      );
      if (outcome === 'ALREADY_RECORDED') {
        throw new AppError(ErrorCode.VALIDATION_FAILED, 'Attendance is already recorded.');
      }
      await this.audit.write(tx, {
        action: 'attendance.mark',
        // The record is written in bulk without returning an ID, so the entry points at the student.
        entityType: 'student',
        entityId: before.student.id,
        after: {
          date: request.date,
          mealType: request.mealType,
          bookingId: booking?.id ?? null,
          source: 'MANUAL_FALLBACK',
          duringOutage: outage !== null,
        },
        reason: request.reason ?? null,
        isOverride: before.needsReason,
      });
    });
    return this.counter.lookup(request);
  }
}
