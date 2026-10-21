import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase, seedFixtures } from './helpers/database';
import { seedRoles, staffToken } from './helpers/staff';
import { createTestApp, type TestApp } from './helpers/test-app';

const PASSWORD = 'correct-horse-1';

/** Error codes, statuses and audit contents promised by docs/api-contract.md. */
describe('contract regressions', () => {
  let ctx: TestApp;
  let adminToken: string;
  const http = () => request(ctx.app.getHttpServer());

  async function registerStudent(referenceNumber: string): Promise<string> {
    const session = await http()
      .post('/api/v1/auth/register')
      .send({ referenceNumber, password: PASSWORD, confirmPassword: PASSWORD })
      .expect(201);
    return session.body.accessToken as string;
  }

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    await seedFixtures(ctx.prisma);
    await seedRoles(ctx.prisma);
    ctx.rateLimiter.reset();
    adminToken = await staffToken(ctx, ['SUPER_ADMIN']);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('answers an oversized upload with 422 FILE_INVALID (§1.2)', async () => {
    const token = await registerStudent('24900001');
    const tooLarge = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.alloc(5 * 1024 * 1024 + 16),
    ]);
    const response = await http()
      .put('/api/v1/me/photo')
      .set('Authorization', `Bearer ${token}`)
      .attach('photo', tooLarge, 'big.jpg');
    expect(response.status).toBe(422);
    expect(response.body.code).toBe('FILE_INVALID');
  });

  it("audits a student correction against the student's own current values", async () => {
    const token = await registerStudent('24900001');
    const me = await http().get('/api/v1/me').set('Authorization', `Bearer ${token}`).expect(200);
    await http()
      .patch('/api/v1/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomNumber: '999', version: me.body.version })
      .expect(200);
    const roster = await ctx.prisma.collegeRosterEntry.findUniqueOrThrow({
      where: { referenceNumber: '24900001' },
    });

    await http()
      .patch(`/api/v1/admin/students/${roster.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roomNumber: '500', reason: 'Room swap', rosterVersion: roster.version })
      .expect(200);
    const audit = await ctx.prisma.auditLog.findFirstOrThrow({
      where: { entityId: roster.id, action: 'student.update' },
    });
    expect(audit.before).toEqual({ roomNumber: '999' });
    expect(audit.after).toEqual({ roomNumber: '500' });
  });

  it('reports a stale policy version as VERSION_CONFLICT even when values match', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const policy = await http().get('/api/v1/admin/policy').set(auth).expect(200);
    const change = { bookingHorizonDays: 10, version: policy.body.version, reason: 'Exams' };
    await http().patch('/api/v1/admin/policy').set(auth).send(change).expect(200);
    const stale = await http().patch('/api/v1/admin/policy').set(auth).send(change);
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('VERSION_CONFLICT');
  });
});
