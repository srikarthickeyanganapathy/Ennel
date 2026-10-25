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
  CLOSE_ATTENDANCE_WINDOWS,
  CloseAttendanceWindowsService,
} from '../services/close-attendance-windows.service';
import {
  GENERATE_DEFAULT_BOOKINGS,
  GenerateDefaultBookingsService,
} from '../services/generate-default-bookings.service';

const QUEUE_NAME = 'ennel-jobs';
/** 00:30 IST: after midnight, so "tomorrow … today + horizon" moves forward by one day. */
const NIGHTLY_PATTERN = '30 0 * * *';
/** Every 5 minutes: a closed window is finalised within minutes (BR-NS-1). */
const WINDOW_PATTERN = '*/5 * * * *';

/**
 * The BullMQ worker process (`pnpm dev:worker`). It schedules the nightly Default Booking run and
 * the attendance window closer, and starts one catch-up run of each on boot; job_runs keeps a
 * date (or date and meal) from being processed twice.
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
    private readonly windows: CloseAttendanceWindowsService,
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
    await this.queue.upsertJobScheduler(
      CLOSE_ATTENDANCE_WINDOWS,
      { pattern: WINDOW_PATTERN, tz: BUSINESS_TIME_ZONE },
      { name: CLOSE_ATTENDANCE_WINDOWS, opts: { removeOnComplete: 100, removeOnFail: 100 } },
    );
    for (const name of [GENERATE_DEFAULT_BOOKINGS, CLOSE_ATTENDANCE_WINDOWS]) {
      await this.queue.add(name, {}, { attempts: 3, removeOnComplete: 100, removeOnFail: 100 });
    }
    this.logger.log(
      `Worker ready; ${GENERATE_DEFAULT_BOOKINGS} runs daily at 00:30 IST, ${CLOSE_ATTENDANCE_WINDOWS} every 5 minutes`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    this.connection?.disconnect();
  }

  private async handle(name: string): Promise<unknown> {
    if (name === GENERATE_DEFAULT_BOOKINGS) return this.generation.run();
    if (name === CLOSE_ATTENDANCE_WINDOWS) return this.windows.run();
    throw new Error(`Unknown job ${name}`);
  }
}
