import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase, seedFixtures } from './helpers/database';
import { createStaff, loginStaff, seedRoles, STAFF_PASSWORD } from './helpers/staff';
import { createTestApp, type TestApp } from './helpers/test-app';

const PASSWORD = 'correct-horse-1';

/** Security decisions approved on 2026-10-24 (ADR-0021). */
describe('security decisions (ADR-0021)', () => {
  let ctx: TestApp;
  const http = () => request(ctx.app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    await seedFixtures(ctx.prisma);
    await seedRoles(ctx.prisma);
    ctx.rateLimiter.reset();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('lets only a Super Admin reset, disable or edit a Super Admin', async () => {
    // A custom grant of staff:manage to Mess Manager, as a Super Admin could configure.
    const manager = await ctx.prisma.role.findUniqueOrThrow({ where: { key: 'MESS_MANAGER' } });
    await ctx.prisma.rolePermission.create({
      data: { roleId: manager.id, permissionKey: 'staff:manage' },
    });
    const managerLogin = await loginStaff(
      ctx,
      (await createStaff(ctx.prisma, ['MESS_MANAGER'])).email,
    );
    const superAdmin = await createStaff(ctx.prisma, ['SUPER_ADMIN']);
    const kitchen = await createStaff(ctx.prisma, ['MESS_STAFF']);
    const as = (path: string) =>
      http().post(path).set(bearer(managerLogin.accessToken)).send({ reason: 'test' });

    expect((await as(`/api/v1/admin/staff-users/${superAdmin.id}/reset-password`)).body.code).toBe(
      'PERMISSION_DENIED',
    );
    await as(`/api/v1/admin/staff-users/${superAdmin.id}/disable`).expect(403);
    await as(`/api/v1/admin/staff-users/${superAdmin.id}/reset-totp`).expect(403);
    await as(`/api/v1/admin/staff-users/${kitchen.id}/reset-password`).expect(200);
  });

  it('ends staff access tokens as soon as the sessions are revoked', async () => {
    const staff = await createStaff(ctx.prisma, ['SUPER_ADMIN']);
    const first = await loginStaff(ctx, staff.email);
    const second = await loginStaff(ctx, staff.email);
    await http().get('/api/v1/admin/auth/me').set(bearer(first.accessToken)).expect(200);

    await http()
      .post('/api/v1/admin/auth/sessions/revoke-all')
      .set(bearer(second.accessToken))
      .expect(204);
    await http().get('/api/v1/admin/auth/me').set(bearer(first.accessToken)).expect(401);
  });

  it('ends a student access token as soon as the student logs out', async () => {
    const session = await http()
      .post('/api/v1/auth/register')
      .send({ referenceNumber: '24900001', password: PASSWORD, confirmPassword: PASSWORD })
      .expect(201);
    const token = session.body.accessToken as string;
    await http().get('/api/v1/me').set(bearer(token)).expect(200);

    await http()
      .post('/api/v1/auth/logout')
      .send({ refreshToken: session.body.refreshToken })
      .expect(204);
    await http().get('/api/v1/me').set(bearer(token)).expect(401);
  });

  it('counts wrong current passwords towards lockout and then ends every session', async () => {
    const staff = await createStaff(ctx.prisma, ['MESS_MANAGER']);
    const login = await loginStaff(ctx, staff.email);
    const change = () =>
      http().post('/api/v1/admin/auth/change-password').set(bearer(login.accessToken)).send({
        currentPassword: 'wrong-password-123',
        newPassword: 'a-brand-new-password-1',
        confirmPassword: 'a-brand-new-password-1',
      });

    for (let attempt = 1; attempt < 5; attempt += 1) {
      expect((await change()).body.code).toBe('VALIDATION_FAILED');
    }
    expect((await change()).body.code).toBe('ACCOUNT_LOCKED');
    await http().get('/api/v1/admin/auth/me').set(bearer(login.accessToken)).expect(401);
    const relogin = await http()
      .post('/api/v1/admin/auth/login')
      .send({ email: staff.email, password: STAFF_PASSWORD });
    expect(relogin.body.code).toBe('ACCOUNT_LOCKED');
  });

  it('reveals a deactivated student account only after the correct password', async () => {
    await http()
      .post('/api/v1/auth/register')
      .send({ referenceNumber: '24900002', password: PASSWORD, confirmPassword: PASSWORD })
      .expect(201);
    await ctx.prisma.student.updateMany({ data: { status: 'DEACTIVATED' } });

    const wrong = await http()
      .post('/api/v1/auth/login')
      .send({ referenceNumber: '24900002', password: 'not-the-password' });
    expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
    const right = await http()
      .post('/api/v1/auth/login')
      .send({ referenceNumber: '24900002', password: PASSWORD });
    expect(right.body.code).toBe('ACCOUNT_LOCKED');
  });

  it('answers a duplicate hostel name with a validation error, not a 500', async () => {
    const token = (await loginStaff(ctx, (await createStaff(ctx.prisma, ['MESS_MANAGER'])).email))
      .accessToken;
    const create = () =>
      http()
        .post('/api/v1/admin/hostels')
        .set(bearer(token))
        .send({ name: 'Race Hostel', reason: 'test' });
    const results = await Promise.all([create(), create(), create()]);
    const statuses = results.map((response) => response.status).sort();
    expect(statuses.filter((status) => status >= 500)).toEqual([]);
    expect(results.filter((response) => response.body.code === 'VALIDATION_FAILED').length).toBe(2);
  });
});
