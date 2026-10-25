import { Injectable, Logger } from '@nestjs/common';
import { addBusinessDays, toBusinessDate } from '@ennel/shared';
import { Clock } from '../../../infrastructure/clock/clock';
import { attendanceWindow } from '../../attendance/domain/attendance-window';
import { AttendanceRepository } from '../../attendance/repositories/attendance.repository';
import { CloseAttendanceWindowService } from '../../attendance/services/close-attendance-window.service';
import { JobRunRecorder } from './job-run-recorder.service';

export const CLOSE_ATTENDANCE_WINDOWS = 'close-attendance-window';

/** Days back to look for windows the worker missed (e.g. it was stopped overnight). */
const CATCH_UP_DAYS = 2;

export interface CloseRunSummary {
  closed: string[];
  failed: string[];
}

/**
 * Runs every few minutes (architecture §3.7): finalises each meal window that has closed in the
 * last few days, once per `date:meal` (job_runs). A failing window is recorded and retried on the
 * next run without blocking the others.
 */
@Injectable()
export class CloseAttendanceWindowsService {
  private readonly logger = new Logger(CloseAttendanceWindowsService.name);

  constructor(
    private readonly attendance: AttendanceRepository,
    private readonly closer: CloseAttendanceWindowService,
    private readonly recorder: JobRunRecorder,
    private readonly clock: Clock,
  ) {}

  async run(): Promise<CloseRunSummary> {
    const now = this.clock.now();
    const today = toBusinessDate(now);
    const meals = await this.attendance.listMeals();
    const summary: CloseRunSummary = { closed: [], failed: [] };
    for (let back = CATCH_UP_DAYS; back >= 0; back -= 1) {
      const date = addBusinessDays(today, -back);
      for (const meal of meals) {
        if (attendanceWindow(date, meal).closesAt > now) continue;
        const runKey = `${date}:${meal.mealType}`;
        try {
          const outcome = await this.recorder.runOnce(CLOSE_ATTENDANCE_WINDOWS, runKey, () =>
            this.closer.close(date, meal),
          );
          if (outcome.status === 'SUCCEEDED') summary.closed.push(runKey);
        } catch (error) {
          summary.failed.push(runKey);
          this.logger.error(
            `${CLOSE_ATTENDANCE_WINDOWS} ${runKey} failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
    return summary;
  }
}
