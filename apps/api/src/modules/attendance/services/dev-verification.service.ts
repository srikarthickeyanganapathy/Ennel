import { Inject, Injectable } from '@nestjs/common';
import {
  type AttendanceDetail,
  type devVerificationRequestSchema,
  ErrorCode,
  toBusinessDate,
} from '@ennel/shared';
import { type z } from 'zod';
import { AppError } from '../../../common/errors/app-error';
import { APP_CONFIG, type AppConfig } from '../../../config/app-config';
import { Clock } from '../../../infrastructure/clock/clock';
import { TransactionRunner } from '../../../infrastructure/database/transaction-runner';
import { activeMealType, attendanceWindow, windowPhase } from '../domain/attendance-window';
import { AttendanceRepository } from '../repositories/attendance.repository';
import { AttendanceRecorder } from './attendance-recorder.service';

type DevRequest = z.output<typeof devVerificationRequestSchema>;

/**
 * Development only (architecture §3, ADR-0025): stands in for the college's face-verification
 * system pushing one verification, so the "Face Verified" flow can be tried locally. It goes
 * through the same recorder as real data and only while the meal window is open.
 */
@Injectable()
export class DevVerificationService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly attendance: AttendanceRepository,
    private readonly recorder: AttendanceRecorder,
    private readonly transactions: TransactionRunner,
    private readonly clock: Clock,
  ) {}

  async verify(request: DevRequest): Promise<AttendanceDetail> {
    if (this.config.nodeEnv !== 'development') {
      throw new AppError(ErrorCode.NOT_FOUND, 'Not found.');
    }
    const now = this.clock.now();
    const date = toBusinessDate(now);
    const meals = await this.attendance.listMeals();
    const mealType = request.mealType ?? activeMealType(meals, date, now);
    const meal = meals.find((item) => item.mealType === mealType);
    if (!meal || windowPhase(attendanceWindow(date, meal), now) !== 'OPEN') {
      throw new AppError(ErrorCode.VALIDATION_FAILED, 'No meal window is open right now.');
    }
    const student = await this.attendance.findStudentByReference(request.referenceNumber);
    if (!student) throw new AppError(ErrorCode.NOT_FOUND, 'No student has this reference number.');
    await this.transactions.run(async (tx) => {
      const booking = (await this.attendance.windowBookings(date, meal.id, tx)).find(
        (item) => item.studentId === student.id,
      );
      const outcome = await this.recorder.record(
        {
          studentId: student.id,
          date,
          mealId: meal.id,
          booking: booking ?? null,
          source: 'FACE_VERIFICATION',
          verifiedAt: now,
          recordedAt: now,
          actor: { type: 'SYSTEM' },
        },
        tx,
      );
      if (outcome === 'ALREADY_RECORDED') {
        throw new AppError(ErrorCode.VALIDATION_FAILED, 'Attendance is already recorded.');
      }
    });
    return {
      source: 'FACE_VERIFICATION',
      verifiedAt: now.toISOString(),
      recordedAt: now.toISOString(),
    };
  }
}
