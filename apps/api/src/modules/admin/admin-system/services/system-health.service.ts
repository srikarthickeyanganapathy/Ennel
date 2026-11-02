import { Inject, Injectable } from '@nestjs/common';
import { BUSINESS_TIME_ZONE, ErrorCode, type SystemHealth } from '@ennel/shared';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppError } from '../../../../common/errors/app-error';
import { APP_CONFIG, type AppConfig } from '../../../../config/app-config';
import { Clock } from '../../../../infrastructure/clock/clock';
import { DatabaseHealthIndicator } from '../../../../infrastructure/database/database-health.indicator';
import { TransactionRunner } from '../../../../infrastructure/database/transaction-runner';
import { AttendanceProvider } from '../../../attendance/provider/attendance-provider';
import { JOB_CATALOG, type JobRunSummaryInput } from '../../../jobs/job-catalog';
import { JobsQueue } from '../../../jobs/jobs-queue.service';
import { JobRunsRepository } from '../../../jobs/repositories/job-runs.repository';
import { AdminAttendanceRepository } from '../../admin-attendance/repositories/admin-attendance.repository';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function appVersion(): string {
  try {
    const manifest: unknown = JSON.parse(
      readFileSync(resolve(__dirname, '../../../../../package.json'), 'utf8'),
    );
    const { version } = manifest as { version?: unknown };
    return typeof version === 'string' ? version : 'unknown';
  } catch {
    return 'unknown';
  }
}

const toSummary = (run: JobRunSummaryInput | null) =>
  run && {
    status: run.status,
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    attempt: run.attempt,
    error: run.error,
  };

/** Admin §Q: job status, queue depth, provider, outage and a config summary without secrets. */
@Injectable()
export class SystemHealthService {
  private readonly version = appVersion();

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly queue: JobsQueue,
    private readonly runs: JobRunsRepository,
    private readonly attendance: AttendanceProvider,
    private readonly admin: AdminAttendanceRepository,
    private readonly database: DatabaseHealthIndicator,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly clock: Clock,
  ) {}

  async health(): Promise<SystemHealth> {
    const now = this.clock.now();
    const since = new Date(now.getTime() - WEEK_MS);
    const [snapshot, isDatabaseUp, outage, jobs] = await Promise.all([
      this.queue.snapshot(since.getTime()),
      this.database.isHealthy(),
      this.admin.activeOutage(),
      Promise.all(
        JOB_CATALOG.map(async (job) => ({
          job,
          last: job.recordsRuns ? await this.runs.latest(job.name) : null,
          failures: job.recordsRuns ? await this.runs.failuresSince(job.name, since) : 0,
        })),
      ),
    ]);
    return {
      generatedAt: now.toISOString(),
      version: this.version,
      environment: this.config.nodeEnv,
      timeZone: BUSINESS_TIME_ZONE,
      pushProvider: this.config.push.provider,
      database: isDatabaseUp ? 'up' : 'down',
      queue: snapshot.depth,
      jobs: jobs.map(({ job, last, failures }) => ({
        name: job.name,
        label: job.label,
        schedule: job.schedule,
        lastRun: toSummary(last ?? snapshot.lastFinished.get(job.name) ?? null),
        nextRunAt: snapshot.nextRuns.get(job.name)?.toISOString() ?? null,
        failuresLast7Days: job.recordsRuns
          ? failures
          : (snapshot.failuresByName.get(job.name) ?? 0),
      })),
      attendanceProvider: this.attendance.status(),
      outage,
    };
  }

  /**
   * Admin §Q retry: queues one run now. job_runs still keeps a finished date from running twice,
   * so this is safe to press. The audit entry commits only if the run was queued.
   */
  async runNow(name: string, reason: string): Promise<void> {
    if (!JOB_CATALOG.some((job) => job.name === name)) {
      throw new AppError(ErrorCode.NOT_FOUND, 'There is no such job.');
    }
    await this.transactions.run(async (tx) => {
      await this.audit.write(tx, {
        action: 'system.job.run',
        entityType: 'job',
        entityId: name,
        reason,
        isOverride: true,
      });
      try {
        await this.queue.add(name);
      } catch {
        throw new AppError(
          ErrorCode.SERVICE_UNAVAILABLE,
          'The job queue cannot be reached. Check that Redis is running.',
        );
      }
    });
  }
}
