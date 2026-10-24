import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { MessConfigModule } from '../mess-config/mess-config.module';
import { JobRunsRepository } from './repositories/job-runs.repository';
import { GenerateDefaultBookingsService } from './services/generate-default-bookings.service';
import { JobRunRecorder } from './services/job-run-recorder.service';

/** Background job logic (architecture §3.7). The BullMQ worker that runs it lives in WorkerModule. */
@Module({
  imports: [BookingsModule, MessConfigModule],
  providers: [JobRunsRepository, JobRunRecorder, GenerateDefaultBookingsService],
  exports: [GenerateDefaultBookingsService],
})
export class JobsModule {}
