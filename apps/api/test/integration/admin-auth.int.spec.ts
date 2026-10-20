import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { generateTotp } from '../../src/modules/admin/admin-auth/domain/totp';
import { resetDatabase } from './helpers/database';
import { auditCount, createStaff, loginStaff, seedRoles, STAFF_PASSWORD } from './helpers/staff';
import { createTestApp, type TestApp } from './helpers/test-app';

function base32Decode(value: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let current = 0;
  const bytes: number[] = [];
  for (const char of value) {
    current = (current << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((current >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

describe('staff authentication (Admin §B)', () => {
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

  it('signs in, sets an httpOnly refresh cookie and never returns the refresh token in JSON', async () => {
    const staff = await createStaff(ctx.prisma, ['MESS_MANAGER']);
    const response = await http()
      .post('/api/v1/admin/auth/login')
      .send({ email: staff.email.toUpperCase(), password: STAFF_PASSWORD })
      .expect(200);
    expect(response.body.status).toBe('AUTHENTICATED');
    expect(JSON.stringify(response.body)).not.toContain('refresh');
    const cookie = String(response.headers['set-cookie']);
    expect(cookie).toMatch(/ennel_staff_refresh=.+HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/admin\/auth/);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });

  it('returns permissions on /me and rotates the refresh cookie', async () => {
    const staff = await createStaff(ctx.prisma, ['WARDEN']);
    const login = await loginStaff(ctx, staff.email);
    const me = await http()
      .get('/api/v1/admin/auth/me')
      .set('Authorization', `Bearer ${login.accessToken}`)
      .expect(200);
    expect(me.body.roles).toEqual(['WARDEN']);
    expect(me.body.permissions).toContain('leaves:approve');
    expect(me.body.permissions).not.toContain('bookings:override');

    const refreshed = await http()
      .post('/api/v1/admin/auth/refresh')
      .set('Cookie', login.cookie)
      .expect(200);
    expect(refreshed.body.accessToken).toBeTruthy();
    await http().post('/api/v1/admin/auth/refresh').set('Cookie', login.cookie).expect(401);
  });

  it('forces a password change before anything else, then audits the change', async () => {
    const staff = await createStaff(ctx.prisma, ['SUPER_ADMIN'], { mustChangePassword: true });
    const login = await loginStaff(ctx, staff.email);
    const auth = { Authorization: `Bearer ${login.accessToken}` };
    const blocked = await http().get('/api/v1/admin/staff-users').set(auth);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
    await http().get('/api/v1/admin/auth/me').set(auth).expect(200);

    const weak = await http()
      .post('/api/v1/admin/auth/change-password')
      .set(auth)
      .send({
        currentPassword: STAFF_PASSWORD,
        newPassword: staff.email,
        confirmPassword: staff.email,
      });
    expect(weak.status).toBe(400);

    const changed = await http()
      .post('/api/v1/admin/auth/change-password')
      .set(auth)
      .send({
        currentPassword: STAFF_PASSWORD,
        newPassword: 'a-brand-new-passphrase',
        confirmPassword: 'a-brand-new-passphrase',
      })
      .expect(200);
    expect(changed.body.mustChangePassword).toBe(false);
    await http()
      .get('/api/v1/admin/staff-users')
      .set('Authorization', `Bearer ${changed.body.accessToken}`)
      .expect(200);
    expect(await auditCount(ctx.prisma, staff.id, 'staff.password.change')).toBe(1);
  });

  it('locks after five failed attempts', async () => {
    const staff = await createStaff(ctx.prisma, ['AUDITOR']);
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const response = await http()
        .post('/api/v1/admin/auth/login')
        .send({ email: staff.email, password: 'wrong-password-x' });
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    }
    const fifth = await http()
      .post('/api/v1/admin/auth/login')
      .send({ email: staff.email, password: 'wrong-password-x' });
    expect(fifth.status).toBe(423);
    const correct = await http()
      .post('/api/v1/admin/auth/login')
      .send({ email: staff.email, password: STAFF_PASSWORD });
    expect(correct.status).toBe(423);
  });

  it('enrols TOTP and then requires a code at sign-in', async () => {
    const staff = await createStaff(ctx.prisma, ['MESS_STAFF']);
    const login = await loginStaff(ctx, staff.email);
    const auth = { Authorization: `Bearer ${login.accessToken}` };
    const enrolment = await http().post('/api/v1/admin/auth/totp/enroll').set(auth).expect(200);
    const secret = base32Decode(enrolment.body.secret);
    await http()
      .post('/api/v1/admin/auth/totp/confirm')
      .set(auth)
      .send({ code: '000000' })
      .expect(400);
    await http()
      .post('/api/v1/admin/auth/totp/confirm')
      .set(auth)
      .send({ code: generateTotp(secret, new Date()) })
      .expect(204);

    const first = await http()
      .post('/api/v1/admin/auth/login')
      .send({ email: staff.email, password: STAFF_PASSWORD })
      .expect(200);
    expect(first.body.status).toBe('TOTP_REQUIRED');
    const verified = await http()
      .post('/api/v1/admin/auth/totp/verify')
      .send({ challengeToken: first.body.challengeToken, code: generateTotp(secret, new Date()) })
      .expect(200);
    expect(verified.body.accessToken).toBeTruthy();
    const stored = await ctx.prisma.staffUser.findUniqueOrThrow({ where: { id: staff.id } });
    expect(stored.totpSecretEnc).not.toContain(enrolment.body.secret);
  });

  it('lists sessions and logs out everywhere', async () => {
    const staff = await createStaff(ctx.prisma, ['WARDEN']);
    const laptop = await loginStaff(ctx, staff.email);
    const phone = await loginStaff(ctx, staff.email);
    const sessions = await http()
      .get('/api/v1/admin/auth/sessions')
      .set('Authorization', `Bearer ${laptop.accessToken}`)
      .expect(200);
    expect(sessions.body.items).toHaveLength(2);
    expect(
      sessions.body.items.filter((item: { isCurrent: boolean }) => item.isCurrent),
    ).toHaveLength(1);

    await http()
      .post('/api/v1/admin/auth/sessions/revoke-all')
      .set('Authorization', `Bearer ${laptop.accessToken}`)
      .expect(204);
    await http().post('/api/v1/admin/auth/refresh').set('Cookie', phone.cookie).expect(401);
  });
});
