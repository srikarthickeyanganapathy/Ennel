import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SecretBox } from '../../src/infrastructure/crypto/secret-box';
import { resetDatabase, seedFixtures } from './helpers/database';
import { createStaff, seedRoles, STAFF_PASSWORD, staffToken } from './helpers/staff';
import { createTestApp, type TestApp } from './helpers/test-app';

const PASSWORD = 'correct-horse-1';

/** Regression tests for lockout and one-time-code limits (BR-AUTH-3, BR-AUTH-6). */
describe('authentication hardening', () => {
  let ctx: TestApp;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    await seedRoles(ctx.prisma);
    ctx.rateLimiter.reset();
    ctx.clock.set(new Date());
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('keeps counting wrong TOTP codes when the password is entered again', async () => {
    const staff = await createStaff(ctx.prisma, ['AUDITOR']);
    const secret = randomBytes(20);
    await ctx.prisma.staffUser.update({
      where: { id: staff.id },
      data: { totpEnabled: true, totpSecretEnc: ctx.app.get(SecretBox).seal(secret) },
    });

    const statuses: number[] = [];
    for (let round = 1; round <= 5; round += 1) {
      const login = await http()
        .post('/api/v1/admin/auth/login')
        .send({ email: staff.email, password: STAFF_PASSWORD });
      if (login.status !== 200) {
        statuses.push(login.status);
        break;
      }
      const verify = await http()
        .post('/api/v1/admin/auth/totp/verify')
        .send({ challengeToken: login.body.challengeToken, code: '000000' });
      statuses.push(verify.status);
    }
    // Five wrong second factors lock the account even though each round re-entered the password.
    expect(statuses.at(-1)).toBe(423);
    const stored = await ctx.prisma.staffUser.findUniqueOrThrow({ where: { id: staff.id } });
    expect(stored.lockedUntil).not.toBeNull();
  });

  it('locks a student after parallel wrong passwords, losing no failure', async () => {
    await seedFixtures(ctx.prisma);
    await http()
      .post('/api/v1/auth/register')
      .send({ referenceNumber: '24900001', password: PASSWORD, confirmPassword: PASSWORD })
      .expect(201);
    await Promise.all(
      Array.from({ length: 6 }, () =>
        http()
          .post('/api/v1/auth/login')
          .send({ referenceNumber: '24900001', password: 'wrong-password' }),
      ),
    );
    const student = await ctx.prisma.student.findFirstOrThrow();
    expect(student.lockedUntil).not.toBeNull();
  });

  it('checks at most five guesses of a reset code, even in parallel (BR-AUTH-6)', async () => {
    await seedFixtures(ctx.prisma);
    await http()
      .post('/api/v1/auth/register')
      .send({ referenceNumber: '24900001', password: PASSWORD, confirmPassword: PASSWORD })
      .expect(201);
    const roster = await ctx.prisma.collegeRosterEntry.findUniqueOrThrow({
      where: { referenceNumber: '24900001' },
    });
    const adminToken = await staffToken(ctx, ['SUPER_ADMIN']);
    const issued = await http()
      .post(`/api/v1/admin/students/${roster.id}/credential-resets`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ kind: 'PASSWORD', reason: 'Forgot password' })
      .expect(201);
    const wrongCode = issued.body.code === 'AAAAAAAAAA' ? 'BBBBBBBBBB' : 'AAAAAAAAAA';
    const attempt = (code: string) =>
      http().post('/api/v1/auth/reset-with-code').send({
        referenceNumber: '24900001',
        code,
        password: 'another-password-2',
        confirmPassword: 'another-password-2',
      });

    const guesses = await Promise.all(Array.from({ length: 8 }, () => attempt(wrongCode)));
    expect(guesses.every((guess) => guess.status === 401)).toBe(true);
    const ticket = await ctx.prisma.credentialResetTicket.findFirstOrThrow();
    expect(ticket.failedAttempts).toBe(5);
    expect((await attempt(issued.body.code)).status).toBe(401);
  });

  it('locks a staff member after parallel wrong passwords', async () => {
    const staff = await createStaff(ctx.prisma, ['AUDITOR']);
    await Promise.all(
      Array.from({ length: 6 }, () =>
        http()
          .post('/api/v1/admin/auth/login')
          .send({ email: staff.email, password: 'wrong-password-x' }),
      ),
    );
    const stored = await ctx.prisma.staffUser.findUniqueOrThrow({ where: { id: staff.id } });
    expect(stored.lockedUntil).not.toBeNull();
  });
});
