import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { BUSINESS_TIME_ZONE } from '@ennel/shared';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { APP_CONFIG, type AppConfig } from '../../../config/app-config';
import {
  GENERATE_DEFAULT_BOOKINGS,
  GenerateDefaultBookingsService,
} from '../services/generate-default-bookings.service';

const QUEUE_NAME = 'ennel-jobs';
/** 00:30 IST: after midnight, so "tomorrow … today + horizon" moves forward by one day. */
const NIGHTLY_PATTERN = '30 0 * * *';

/**
 * The BullMQ worker process (`pnpm dev:worker`). It schedules the nightly Default Booking run and
 * starts one catch-up run on boot; job_runs keeps a date from being processed twice.
 */
@Injectable()
export class JobsWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsWorker.name);
  private connection?: Redis;
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly generation: GenerateDefaultBookingsService,
  ) {}

  async onModuleInit(): Promise<void> {
    // BullMQ needs maxRetriesPerRequest: null for its blocking commands.
    this.connection = new Redis(this.config.redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue(QUEUE_NAME, { connection: this.connection });
    this.worker = new Worker(QUEUE_NAME, (job) => this.handle(job.name), {
      connection: this.connection,
      concurrency: 1,
    });
    this.worker.on('failed', (job, error) =>
      this.logger.error(`${job?.name ?? 'job'} failed: ${error.message}`),
    );
    await this.queue.upsertJobScheduler(
      GENERATE_DEFAULT_BOOKINGS,
      { pattern: NIGHTLY_PATTERN, tz: BUSINESS_TIME_ZONE },
      {
        name: GENERATE_DEFAULT_BOOKINGS,
        opts: { attempts: 3, backoff: { type: 'exponential', delay: 60_000 } },
      },
    );
    await this.queue.add(
      GENERATE_DEFAULT_BOOKINGS,
      {},
      { attempts: 3, removeOnComplete: 100, removeOnFail: 100 },
    );
    this.logger.log(`Worker ready; ${GENERATE_DEFAULT_BOOKINGS} runs daily at 00:30 IST`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    this.connection?.disconnect();
  }

  private async handle(name: string): Promise<unknown> {
    if (name === GENERATE_DEFAULT_BOOKINGS) return this.generation.run();
    throw new Error(`Unknown job ${name}`);
  }
}
