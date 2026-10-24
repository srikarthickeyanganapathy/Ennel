import { Module } from '@nestjs/common';
import { AppModule } from '../../../app.module';
import { JobsModule } from '../jobs.module';
import { JobsWorker } from './jobs.worker';

/** Entry module for the worker process: the whole application context plus the BullMQ worker. */
@Module({
  imports: [AppModule, JobsModule],
  providers: [JobsWorker],
})
export class WorkerModule {}
