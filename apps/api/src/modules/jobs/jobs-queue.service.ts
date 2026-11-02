import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { type JobRunSummaryInput } from './job-catalog';

export const QUEUE_NAME = 'ennel-jobs';

const REDIS_TIMEOUT_MS = 2_000;
const FINISHED_JOBS_READ = 200;

export interface QueueDepth {
  isAvailable: boolean;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
}

export interface QueueSnapshot {
  depth: QueueDepth;
  nextRuns: Map<string, Date>;
  /** Newest finished run per job name, for jobs too frequent to record in job_runs. */
  lastFinished: Map<string, JobRunSummaryInput>;
  failuresByName: Map<string, number>;
}

const UNAVAILABLE: QueueSnapshot = {
  depth: { isAvailable: false, waiting: 0, active: 0, delayed: 0, failed: 0 },
  nextRuns: new Map(),
  lastFinished: new Map(),
  failuresByName: new Map(),
};

function withTimeout<T>(work: Promise<T>): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('Redis did not answer')), REDIS_TIMEOUT_MS);
    }),
  ]);
}

/**
 * The API's view of the worker's BullMQ queue (Admin §Q). Created on first use, so the API still
 * boots and answers without Redis; system health then reports the queue as unavailable.
 */
@Injectable()
export class JobsQueue implements OnModuleDestroy {
  private connection?: Redis;
  private queue?: Queue;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  private open(): Queue {
    if (!this.queue) {
      this.connection = new Redis(this.config.redisUrl, { maxRetriesPerRequest: null });
      // Without a listener ioredis logs every failed reconnect; health reports the outage instead.
      this.connection.on('error', () => undefined);
      this.queue = new Queue(QUEUE_NAME, { connection: this.connection });
      this.queue.on('error', () => undefined);
    }
    return this.queue;
  }

  async snapshot(sinceMs: number): Promise<QueueSnapshot> {
    try {
      const queue = this.open();
      const [counts, schedulers, finished] = await withTimeout(
        Promise.all([
          queue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
          queue.getJobSchedulers(),
          queue.getJobs(['completed', 'failed'], 0, FINISHED_JOBS_READ),
        ]),
      );
      const lastFinished = new Map<string, JobRunSummaryInput>();
      const failuresByName = new Map<string, number>();
      for (const job of finished) {
        const finishedOn = job.finishedOn ?? 0;
        const previous = lastFinished.get(job.name);
        if (job.failedReason && finishedOn >= sinceMs) {
          failuresByName.set(job.name, (failuresByName.get(job.name) ?? 0) + 1);
        }
        if (!previous || finishedOn > (previous.finishedAt?.getTime() ?? 0)) {
          lastFinished.set(job.name, {
            status: job.failedReason ? 'FAILED' : 'SUCCEEDED',
            startedAt: job.processedOn ? new Date(job.processedOn) : null,
            finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
            attempt: job.attemptsMade,
            error: job.failedReason ?? null,
          });
        }
      }
      return {
        depth: {
          isAvailable: true,
          waiting: counts['waiting'] ?? 0,
          active: counts['active'] ?? 0,
          delayed: counts['delayed'] ?? 0,
          failed: counts['failed'] ?? 0,
        },
        nextRuns: new Map(
          schedulers.flatMap((scheduler) =>
            scheduler.next ? [[scheduler.key, new Date(scheduler.next)] as const] : [],
          ),
        ),
        lastFinished,
        failuresByName,
      };
    } catch {
      return UNAVAILABLE;
    }
  }

  /** Queues one run now. Throws when Redis cannot be reached. */
  async add(name: string): Promise<void> {
    await withTimeout(
      this.open().add(name, {}, { attempts: 1, removeOnComplete: 100, removeOnFail: 100 }),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
    this.connection?.disconnect();
  }
}
