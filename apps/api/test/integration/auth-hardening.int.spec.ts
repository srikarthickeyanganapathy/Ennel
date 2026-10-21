import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SecretBox } from '../../src/infrastructure/crypto/secret-box';
import { resetDatabase } from './helpers/database';
import { createStaff, seedRoles, STAFF_PASSWORD } from './helpers/staff';
import { createTestApp, type TestApp } from './helpers/test-app';

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
});
