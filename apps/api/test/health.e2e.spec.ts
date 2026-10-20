import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { APP_CONFIG, parseAppConfig } from '../src/config/app-config';
import { Clock } from '../src/infrastructure/clock/clock';
import { FakeClock } from '../src/infrastructure/clock/fake-clock';
import { DatabaseHealthIndicator } from '../src/infrastructure/database/database-health.indicator';
import { PrismaService } from '../src/infrastructure/database/prisma.service';

const TEST_CONFIG = parseAppConfig({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://unused:unused@localhost:5432/unused',
  REDIS_URL: 'redis://localhost:6379',
  JWT_STUDENT_SECRET: 's'.repeat(32),
  JWT_STAFF_SECRET: 't'.repeat(32),
  FILE_SIGNING_SECRET: 'f'.repeat(32),
  TOTP_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
});

describe('GET /api/v1/health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(TEST_CONFIG)
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(DatabaseHealthIndicator)
      .useValue({ isHealthy: async () => true })
      .overrideProvider(Clock)
      .useValue(new FakeClock('2026-10-19T05:30:00.000Z'))
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports status with the clock time and a request ID header', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(response.body).toEqual({
      status: 'ok',
      database: 'up',
      time: '2026-10-19T05:30:00.000Z',
    });
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  it('returns the standard error shape for unknown routes', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/nope')
      .set('x-request-id', 'test-request-0001')
      .expect(404);
    expect(response.body).toMatchObject({ code: 'NOT_FOUND', requestId: 'test-request-0001' });
  });
});
