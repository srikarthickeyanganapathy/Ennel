import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from './helpers/database';
import { auditCount, createStaff, loginStaff, seedRoles } from './helpers/staff';
import { createTestApp, type TestApp } from './helpers/test-app';

describe('staff and role management (Admin §A, §P)', () => {
  let ctx: TestApp;
  let adminToken: string;
  let adminId: string;
  const http = () => request(ctx.app.getHttpServer());
  const asAdmin = (method: 'get' | 'post' | 'put' | 'patch', path: string) =>
    http()[method](path).set('Authorization', `Bearer ${adminToken}`);

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    await seedRoles(ctx.prisma);
    ctx.rateLimiter.reset();
    const admin = await createStaff(ctx.prisma, ['SUPER_ADMIN']);
    adminId = admin.id;
    adminToken = (await loginStaff(ctx, admin.email)).accessToken;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('creates staff with a one-time temporary password and writes exactly one audit entry', async () => {
    const created = await asAdmin('post', '/api/v1/admin/staff-users')
      .send({ email: 'Warden@Ennel.test', fullName: 'Block Warden', roles: ['WARDEN'] })
      .expect(201);
    expect(created.body.staff).toMatchObject({
      email: 'warden@ennel.test',
      roles: ['WARDEN'],
      mustChangePassword: true,
    });
    expect(created.body.temporaryPassword).toHaveLength(24);
    expect(await auditCount(ctx.prisma, created.body.staff.id, 'staff.create')).toBe(1);
    const entry = await ctx.prisma.auditLog.findFirstOrThrow({
      where: { entityId: created.body.staff.id },
    });
    expect(entry).toMatchObject({
      actorId: adminId,
      actorType: 'STAFF',
      actorRoles: ['SUPER_ADMIN'],
    });
    expect(JSON.stringify(entry.after)).not.toContain('passwordHash');

    const login = await loginStaff(ctx, 'warden@ennel.test', created.body.temporaryPassword);
    expect(login.accessToken).toBeTruthy();
  });

  it('shows when staff were last active, and never for someone who has not signed in', async () => {
    const created = await asAdmin('post', '/api/v1/admin/staff-users')
      .send({ email: 'new.staff@ennel.test', fullName: 'New Staff', roles: ['WARDEN'] })
      .expect(201);
    const list = await asAdmin('get', '/api/v1/admin/staff-users').expect(200);
    const row = (id: string) =>
      list.body.items.find((item: { id: string }) => item.id === id) as { lastActiveAt: string };
    expect(row(created.body.staff.id).lastActiveAt).toBeNull();
    const signedIn = list.body.items.find(
      (item: { email: string }) => item.email !== 'new.staff@ennel.test',
    );
    expect(signedIn.lastActiveAt).toEqual(expect.any(String));
  });

  it('rejects a stale version and writes no audit entry for the failed change', async () => {
    const warden = await createStaff(ctx.prisma, ['WARDEN']);
    await asAdmin('patch', `/api/v1/admin/staff-users/${warden.id}`)
      .send({ fullName: 'Renamed', version: 1 })
      .expect(200);
    const stale = await asAdmin('patch', `/api/v1/admin/staff-users/${warden.id}`).send({
      fullName: 'Again',
      version: 1,
    });
    expect(stale.status).toBe(409);
    expect(await auditCount(ctx.prisma, warden.id, 'staff.update')).toBe(1);
  });

  it('requires a reason to disable, ends sessions, and blocks the disabled account at once', async () => {
    const warden = await createStaff(ctx.prisma, ['WARDEN']);
    const wardenLogin = await loginStaff(ctx, warden.email);
    await asAdmin('post', `/api/v1/admin/staff-users/${warden.id}/disable`).send({}).expect(400);
    await asAdmin('post', `/api/v1/admin/staff-users/${warden.id}/disable`)
      .send({ reason: 'Left the college' })
      .expect(200);

    await http()
      .get('/api/v1/admin/auth/me')
      .set('Authorization', `Bearer ${wardenLogin.accessToken}`)
      .expect(401);
    await http().post('/api/v1/admin/auth/refresh').set('Cookie', wardenLogin.cookie).expect(401);
    const entry = await ctx.prisma.auditLog.findFirstOrThrow({
      where: { entityId: warden.id, action: 'staff.disable' },
    });
    expect(entry.reason).toBe('Left the college');
  });

  it('keeps at least one active Super Admin and forbids self-disable', async () => {
    const self = await asAdmin('post', `/api/v1/admin/staff-users/${adminId}/disable`).send({
      reason: 'test',
    });
    expect(self.status).toBe(400);
    const demote = await asAdmin('put', `/api/v1/admin/staff-users/${adminId}/roles`).send({
      roles: ['WARDEN'],
      reason: 'test',
      version: 1,
    });
    expect(demote.status).toBe(400);
  });

  it('edits role permissions, applies them immediately and protects the Super Admin role', async () => {
    const roles = (await asAdmin('get', '/api/v1/admin/roles').expect(200)).body.items as {
      id: string;
      key: string;
      permissions: string[];
    }[];
    const warden = roles.find((role) => role.key === 'WARDEN');
    const superAdmin = roles.find((role) => role.key === 'SUPER_ADMIN');
    if (!warden || !superAdmin) throw new Error('roles not seeded');

    const wardenStaff = await createStaff(ctx.prisma, ['WARDEN']);
    const wardenToken = (await loginStaff(ctx, wardenStaff.email)).accessToken;
    await http()
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${wardenToken}`)
      .expect(403);

    await asAdmin('put', `/api/v1/admin/roles/${warden.id}/permissions`)
      .send({
        permissions: [...warden.permissions, 'audit-log:read'],
        reason: 'Wardens review the audit log',
      })
      .expect(200);
    await http()
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${wardenToken}`)
      .expect(200);

    const locked = await asAdmin('put', `/api/v1/admin/roles/${superAdmin.id}/permissions`).send({
      permissions: [],
      reason: 'test',
    });
    expect(locked.status).toBe(400);
  });

  it('serves the audit log with filters and CSV export, and has no write endpoints', async () => {
    const created = await asAdmin('post', '/api/v1/admin/staff-users')
      .send({ email: 'auditee@ennel.test', fullName: 'Auditee', roles: ['AUDITOR'] })
      .expect(201);
    const list = await asAdmin(
      'get',
      `/api/v1/admin/audit-logs?entityId=${created.body.staff.id}`,
    ).expect(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0]).toMatchObject({
      action: 'staff.create',
      actorName: 'Test SUPER_ADMIN',
    });

    const csv = await asAdmin(
      'get',
      `/api/v1/admin/audit-logs/export?entityId=${created.body.staff.id}`,
    ).expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('staff.create');

    const id = list.body.items[0].id as string;
    await asAdmin('patch', `/api/v1/admin/audit-logs/${id}`).send({}).expect(404);
    await http()
      .delete(`/api/v1/admin/audit-logs/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});
