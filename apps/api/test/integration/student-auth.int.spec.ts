import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Fixtures, resetDatabase, seedFixtures } from './helpers/database';
import { createTestApp, type TestApp } from './helpers/test-app';

const PASSWORD = 'correct-horse-1';

describe('student auth (Spec §3 Screens 2-4, Rule 11)', () => {
  let ctx: TestApp;
  let fixtures: Fixtures;
  const http = () => request(ctx.app.getHttpServer());

  const register = (referenceNumber: string) =>
    http()
      .post('/api/v1/auth/register')
      .send({ referenceNumber, password: PASSWORD, confirmPassword: PASSWORD });

  const login = (referenceNumber: string, password = PASSWORD) =>
    http().post('/api/v1/auth/login').send({ referenceNumber, password });

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    fixtures = await seedFixtures(ctx.prisma);
    ctx.rateLimiter.reset();
    ctx.clock.set(new Date());
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('roster check', () => {
    it('accepts a roster number typed with spaces', async () => {
      const response = await http()
        .post('/api/v1/auth/roster-check')
        .send({ referenceNumber: '24 900 001' });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'NEW' });
    });

    it.each(['11112222', '24900099'])(
      'rejects unknown or inactive number %s',
      async (referenceNumber) => {
        const response = await http().post('/api/v1/auth/roster-check').send({ referenceNumber });
        expect(response.status).toBe(404);
        expect(response.body.code).toBe('ROSTER_NOT_FOUND');
      },
    );

    it('reports REGISTERED after account creation', async () => {
      await register(fixtures.referenceNumbers[0]!).expect(201);
      const response = await http()
        .post('/api/v1/auth/roster-check')
        .send({ referenceNumber: fixtures.referenceNumbers[0] });
      expect(response.body).toEqual({ status: 'REGISTERED' });
    });
  });

  describe('registration', () => {
    it('creates the account, prefills roster data and never returns the hash', async () => {
      const response = await register(fixtures.referenceNumbers[0]!).expect(201);
      expect(response.body).toMatchObject({ isOnboardingComplete: false });
      expect(response.body.accessToken).toBeTruthy();
      expect(JSON.stringify(response.body)).not.toContain('argon2');

      const student = await ctx.prisma.student.findFirstOrThrow();
      expect(student.passwordHash.startsWith('$argon2id$')).toBe(true);
      expect(student).toMatchObject({ fullName: 'Test Student 1', roomNumber: '100' });
      expect(student.hostelBlockId).toBe(fixtures.blockId);
    });

    it('rejects mismatched passwords with the spec message', async () => {
      const response = await http()
        .post('/api/v1/auth/register')
        .send({ referenceNumber: '24900001', password: PASSWORD, confirmPassword: 'other-pass-1' });
      expect(response.status).toBe(400);
      expect(response.body.details.issues).toContainEqual({
        path: 'confirmPassword',
        message: 'Passwords do not match.',
      });
    });

    it('rejects a second registration', async () => {
      await register('24900001').expect(201);
      const response = await register('24900001');
      expect(response.status).toBe(409);
      expect(response.body.code).toBe('ALREADY_REGISTERED');
    });

    it('rejects numbers outside the roster', async () => {
      const response = await register('11112222');
      expect(response.body.code).toBe('ROSTER_NOT_FOUND');
    });
  });

  describe('login and lockout (BR-AUTH-3)', () => {
    beforeEach(async () => {
      await register('24900001').expect(201);
    });

    it('signs in with the correct password', async () => {
      const response = await login('24 900 001');
      expect(response.status).toBe(200);
      expect(response.body.refreshToken).toBeTruthy();
    });

    it('gives the same error for a wrong password and an unknown account', async () => {
      const wrong = await login('24900001', 'wrong-password');
      const unknown = await login('24900002');
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(wrong.body.message).toBe(unknown.body.message);
    });

    it('locks after five failures and unlocks after fifteen minutes', async () => {
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        expect((await login('24900001', 'wrong-password')).body.code).toBe('INVALID_CREDENTIALS');
      }
      expect((await login('24900001', 'wrong-password')).body.code).toBe('ACCOUNT_LOCKED');
      const whileLocked = await login('24900001');
      expect(whileLocked.status).toBe(423);

      ctx.clock.advanceMinutes(15);
      expect((await login('24900001')).status).toBe(200);
    });

    it('refuses a deactivated account', async () => {
      await ctx.prisma.student.updateMany({ data: { status: 'DEACTIVATED' } });
      expect((await login('24900001')).body.code).toBe('ACCOUNT_LOCKED');
    });

    it('rate-limits repeated login requests from one client', async () => {
      for (let attempt = 1; attempt <= 10; attempt += 1) await login('24900002');
      const response = await login('24900002');
      expect(response.status).toBe(429);
      expect(response.body.code).toBe('RATE_LIMITED');
    });
  });

  describe('refresh rotation (ADR-0015)', () => {
    it('rotates tokens and revokes the family when an old token is reused', async () => {
      const first = (await register('24900001').expect(201)).body;
      const second = (
        await http().post('/api/v1/auth/refresh').send({ refreshToken: first.refreshToken })
      ).body;
      expect(second.refreshToken).toBeTruthy();
      expect(second.refreshToken).not.toBe(first.refreshToken);

      const reuse = await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: first.refreshToken });
      expect(reuse.status).toBe(401);
      const afterReuse = await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: second.refreshToken });
      expect(afterReuse.status).toBe(401);
    });

    it('ends the session on logout', async () => {
      const session = (await register('24900001').expect(201)).body;
      await http()
        .post('/api/v1/auth/logout')
        .send({ refreshToken: session.refreshToken })
        .expect(204);
      const response = await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken });
      expect(response.status).toBe(401);
    });
  });

  describe('StudentJwtAuthGuard', () => {
    it('requires a token', async () => {
      const response = await http().get('/api/v1/me');
      expect(response.status).toBe(401);
      expect(response.body.code).toBe('UNAUTHENTICATED');
    });

    it('rejects a staff-audience token signed with the staff secret', async () => {
      const student = (await register('24900001').expect(201)).body;
      const studentId = (await ctx.prisma.student.findFirstOrThrow()).id;
      const staffToken = await new JwtService().signAsync(
        { typ: 'student' },
        {
          secret: process.env.JWT_STAFF_SECRET,
          audience: 'ennel-staff',
          issuer: 'ennel-api',
          subject: studentId,
          expiresIn: 60,
        },
      );
      await http()
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${student.accessToken}`)
        .expect(200);
      const response = await http().get('/api/v1/me').set('Authorization', `Bearer ${staffToken}`);
      expect(response.status).toBe(401);
    });
  });
});
