import { Injectable, Logger } from '@nestjs/common';
import { addBusinessDays, type BusinessDate, toBusinessDate } from '@ennel/shared';
import { Clock } from '../../../infrastructure/clock/clock';
import { TransactionRunner } from '../../../infrastructure/database/transaction-runner';
import {
  BookingReconciler,
  emptyStats,
  type ReconcileStats,
} from '../../bookings/services/booking-reconciler.service';
import { GetMessPolicyService } from '../../mess-config/services/get-mess-policy.service';
import { JobRunsRepository } from '../repositories/job-runs.repository';
import { type JobOutcome, JobRunRecorder } from './job-run-recorder.service';

export const GENERATE_DEFAULT_BOOKINGS = 'generate-default-bookings';

export interface GenerationStats extends ReconcileStats {
  students: number;
  failedStudents: number;
  from: BusinessDate;
  to: BusinessDate;
}

/**
 * BR-DEF-1 nightly job: materializes recurring bookings for tomorrow … today + horizon. Each
 * student runs in their own transaction, so one failure never blocks the rest. Idempotent:
 * reconciliation only creates what is missing, and a finished date is skipped.
 */
@Injectable()
export class GenerateDefaultBookingsService {
  private readonly logger = new Logger(GenerateDefaultBookingsService.name);

  constructor(
    private readonly reconciler: BookingReconciler,
    private readonly runs: JobRunsRepository,
    private readonly recorder: JobRunRecorder,
    private readonly policies: GetMessPolicyService,
    private readonly transactions: TransactionRunner,
    private readonly clock: Clock,
  ) {}

  run(): Promise<JobOutcome<GenerationStats>> {
    const today = toBusinessDate(this.clock.now());
    return this.recorder.runOnce(GENERATE_DEFAULT_BOOKINGS, today, () => this.generate(today));
  }

  private async generate(today: BusinessDate): Promise<GenerationStats> {
    const policy = await this.policies.execute();
    const dates = Array.from({ length: policy.bookingHorizonDays }, (_, index) =>
      addBusinessDays(today, index + 1),
    );
    const stats: GenerationStats = {
      ...emptyStats(),
      students: 0,
      failedStudents: 0,
      from: dates[0] ?? today,
      to: dates.at(-1) ?? today,
    };
    for (const studentId of await this.runs.listEligibleStudentIds()) {
      try {
        const studentStats = await this.transactions.run(
          (tx) => this.reconciler.reconcile(studentId, dates, policy, tx),
          { timeoutMs: 30_000 },
        );
        // Counted only after the student's transaction committed.
        addStats(stats, studentStats);
        stats.students += 1;
      } catch (error) {
        stats.failedStudents += 1;
        // The student id is not personal data; the error message never contains any.
        this.logger.error(
          `Generation failed for student ${studentId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return stats;
  }
}

function addStats(total: ReconcileStats, part: ReconcileStats): void {
  for (const key of Object.keys(part) as (keyof ReconcileStats)[]) total[key] += part[key];
}
