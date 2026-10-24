import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { StructuredLogger } from './common/logging/structured-logger';
import { WorkerModule } from './modules/jobs/worker/worker.module';

/** Background worker (architecture §3.7): no HTTP server, only BullMQ jobs. */
async function bootstrap(): Promise<void> {
  const logger = new StructuredLogger(process.env.NODE_ENV !== 'production');
  const app = await NestFactory.createApplicationContext(WorkerModule, { logger });
  app.enableShutdownHooks();
}

void bootstrap();
