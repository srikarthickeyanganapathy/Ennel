import { Injectable, Logger } from '@nestjs/common';
import { Clock } from '../../../infrastructure/clock/clock';
import { JobRunsRepository } from '../repositories/job-runs.repository';

/** A run still marked RUNNING after this long is assumed to have crashed and is retried. */
const STALE_RUN_MS = 60 * 60 * 1000;

export type JobOutcome<T> = { status: 'SKIPPED' } | { status: 'SUCCEEDED'; stats: T };

/**
 * Runs a job at most once per run key (architecture §3.7): a finished or in-progress run is
 * skipped, a failed or stale one is retried with a higher attempt number. Errors are recorded and re-thrown for BullMQ.
 */
@Injectable()
export class JobRunRecorder {
  private readonly logger = new Logger(JobRunRecorder.name);

  constructor(
    private readonly runs: JobRunsRepository,
    private readonly clock: Clock,
  ) {}

  async runOnce<T extends object>(
    jobName: string,
    runKey: string,
    work: () => Promise<T>,
  ): Promise<JobOutcome<T>> {
    const previous = await this.runs.find(jobName, runKey);
    const now = this.clock.now();
    if (previous?.status === 'SUCCEEDED') return { status: 'SKIPPED' };
    if (
      previous?.status === 'RUNNING' &&
      now.getTime() - previous.startedAt.getTime() < STALE_RUN_MS
    ) {
      return { status: 'SKIPPED' };
    }
    const id = await this.runs.start(jobName, runKey, now, previous);
    try {
      const stats = await work();
      await this.runs.finish(id, this.clock.now(), { stats });
      this.logger.log(`${jobName} ${runKey} finished`);
      return { status: 'SUCCEEDED', stats };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.runs.finish(id, this.clock.now(), { error: message });
      throw error;
    }
  }
}
