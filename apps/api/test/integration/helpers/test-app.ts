import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppModule } from '../../../src/app.module';
import { InMemoryRateLimiter } from '../../../src/common/rate-limit/in-memory-rate-limiter';
import { RateLimiter } from '../../../src/common/rate-limit/rate-limiter';
import { APP_CONFIG, loadAppConfig } from '../../../src/config/app-config';
import { API_PREFIX } from '../../../src/config/api-prefix';
import { Clock } from '../../../src/infrastructure/clock/clock';
import { FakeClock } from '../../../src/infrastructure/clock/fake-clock';
import { PrismaService } from '../../../src/infrastructure/database/prisma.service';
import { AttendanceProvider } from '../../../src/modules/attendance/provider/attendance-provider';
import { FakeAttendanceProvider } from './fake-attendance-provider';

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
  clock: FakeClock;
  rateLimiter: InMemoryRateLimiter;
  attendanceProvider: FakeAttendanceProvider;
}

/**
 * Full AppModule against the test database. The clock starts at the real time because JWT
 * expiry is checked against the system clock; tests advance it for lockout scenarios.
 */
export async function createTestApp(): Promise<TestApp> {
  const clock = new FakeClock(new Date());
  const rateLimiter = new InMemoryRateLimiter();
  const attendanceProvider = new FakeAttendanceProvider();
  const config = { ...loadAppConfig(), storageDir: mkdtempSync(join(tmpdir(), 'ennel-storage-')) };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(APP_CONFIG)
    .useValue(config)
    .overrideProvider(Clock)
    .useValue(clock)
    .overrideProvider(RateLimiter)
    .useValue(rateLimiter)
    .overrideProvider(AttendanceProvider)
    .useValue(attendanceProvider)
    .compile();
  const app = moduleRef.createNestApplication({
    logger: process.env.TEST_LOGS ? ['error'] : false,
  });
  app.setGlobalPrefix(API_PREFIX);
  // A bound port avoids supertest re-binding the server for each request.
  await app.listen(0, '127.0.0.1');
  return { app, prisma: app.get(PrismaService), clock, rateLimiter, attendanceProvider };
}
