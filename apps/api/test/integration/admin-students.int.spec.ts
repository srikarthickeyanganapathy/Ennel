import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase, seedFixtures } from './helpers/database';
import { auditCount, seedRoles, staffToken } from './helpers/staff';
import { createTestApp, type TestApp } from './helpers/test-app';

const HEADER = 'Reference Number,Full Name,Department,Academic Year,Hostel,Block,Room Number,Email';
const csv = (...lines: string[]) => Buffer.from([HEADER, ...lines].join('\n'));
const PASSWORD = 'correct-horse-1';

describe('roster import and student management (Admin §G)', () => {
  let ctx: TestApp;
  let adminToken: string;
  const http = () => request(ctx.app.getHttpServer());
  const asAdmin = (method: 'get' | 'post' | 'patch', path: string) =>
    http()[method](path).set('Authorization', `Bearer ${adminToken}`);
  const upload = (file: Buffer, name = 'roster.csv') =>
    asAdmin('post', '/api/v1/admin/roster-imports').attach('file', file, {
      filename: name,
      contentType: 'text/csv',
    });

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

  it('previews row-level errors and duplicates, and blocks confirmation', async () => {
    const preview = await upload(
      csv(
        '24910001,New Student,Civil,1,Test Hostel,Block A,12,new@example.com',
        '24910002,Bad Year,Civil,nine,,,,',
        '24910003,Twice,Civil,1,,,,',
        '24910003,Twice Again,Civil,1,,,,',
        '24900001,Test Student 1,Computer Science,2,Test Hostel,Block A,100,',
        '24900002,Test Student 2 Renamed,Computer Science,2,Test Hostel,Block A,101,',
      ),
    ).expect(201);
    expect(preview.body).toMatchObject({
      status: 'VALIDATED',
      totalRows: 6,
      canConfirm: false,
      counts: {
        VALID: 1,
        INVALID: 1,
        DUPLICATE_IN_FILE: 2,
        EXISTING_UNCHANGED: 1,
        EXISTING_UPDATE: 1,
      },
    });
    const invalid = await asAdmin(
      'get',
      `/api/v1/admin/roster-imports/${preview.body.id}/rows?outcome=INVALID`,
    ).expect(200);
    expect(invalid.body.items[0]).toMatchObject({
      rowNumber: 3,
      errors: [{ field: 'academicYear' }],
    });
    const updates = await asAdmin(
      'get',
      `/api/v1/admin/roster-imports/${preview.body.id}/rows?outcome=EXISTING_UPDATE`,
    ).expect(200);
    expect(updates.body.items[0].changes).toEqual(['fullName']);

    const confirm = await asAdmin(
      'post',
      `/api/v1/admin/roster-imports/${preview.body.id}/confirm`,
    );
    expect(confirm.status).toBe(422);
    expect(confirm.body.code).toBe('ROSTER_IMPORT_INVALID');
    expect(
      await ctx.prisma.collegeRosterEntry.count({ where: { referenceNumber: '24910001' } }),
    ).toBe(0);
  });

  it('imports a clean file, updates existing entries and copies controlled fields to students', async () => {
    await http()
      .post('/api/v1/auth/register')
      .send({ referenceNumber: '24900002', password: PASSWORD, confirmPassword: PASSWORD })
      .expect(201);
    const preview = await upload(
      csv(
        '24910001,New Student,Civil,1,Test Hostel,Block A,12,new@example.com',
        '24900002,Test Student 2 Renamed,Computer Science,3,Test Hostel,Block A,999,',
      ),
    ).expect(201);
    expect(preview.body.canConfirm).toBe(true);
    const confirmed = await asAdmin(
      'post',
      `/api/v1/admin/roster-imports/${preview.body.id}/confirm`,
    ).expect(200);
    expect(confirmed.body.status).toBe('COMPLETED');
    await asAdmin('post', `/api/v1/admin/roster-imports/${preview.body.id}/confirm`).expect(422);

    expect(
      await ctx.prisma.collegeRosterEntry.count({ where: { referenceNumber: '24910001' } }),
    ).toBe(1);
    const student = await ctx.prisma.student.findFirstOrThrow({
      where: { rosterEntry: { referenceNumber: '24900002' } },
    });
    // fullName and academicYear are college-controlled; room number is student-editable (ADR-0018).
    expect(student).toMatchObject({
      fullName: 'Test Student 2 Renamed',
      academicYear: 3,
      roomNumber: '101',
    });
    expect(await auditCount(ctx.prisma, preview.body.id, 'roster-import.confirm')).toBe(1);
  });

  it('rejects files with missing columns or unreadable content', async () => {
    const missing = await upload(Buffer.from('Name,Hostel\nA,B'));
    expect(missing.body).toMatchObject({
      code: 'ROSTER_IMPORT_INVALID',
      details: { missingColumns: ['referenceNumber', 'fullName', 'department', 'academicYear'] },
    });
    const fakeXlsx = await upload(Buffer.from('not a workbook'), 'roster.xlsx');
    expect(fakeXlsx.body.code).toBe('ROSTER_IMPORT_INVALID');
  });

  it('lists and filters students, including unregistered ones', async () => {
    await http()
      .post('/api/v1/auth/register')
      .send({ referenceNumber: '24900001', password: PASSWORD, confirmPassword: PASSWORD })
      .expect(201);
    const all = await asAdmin('get', '/api/v1/admin/students').expect(200);
    expect(all.body.total).toBe(4);
    const registered = await asAdmin(
      'get',
      '/api/v1/admin/students?registration=REGISTERED',
    ).expect(200);
    expect(
      registered.body.items.map((item: { referenceNumber: string }) => item.referenceNumber),
    ).toEqual(['24900001']);
    const search = await asAdmin('get', '/api/v1/admin/students?q=24 900 003').expect(200);
    expect(search.body.items).toHaveLength(1);
  });

  it('locks a student with a reason, ending their session, and unlocks again', async () => {
    const session = (
      await http()
        .post('/api/v1/auth/register')
        .send({ referenceNumber: '24900001', password: PASSWORD, confirmPassword: PASSWORD })
    ).body;
    const roster = await ctx.prisma.collegeRosterEntry.findUniqueOrThrow({
      where: { referenceNumber: '24900001' },
    });

    await asAdmin('post', `/api/v1/admin/students/${roster.id}/lock`)
      .send({ reason: '' })
      .expect(400);
    const locked = await asAdmin('post', `/api/v1/admin/students/${roster.id}/lock`)
      .send({ reason: 'Card misuse' })
      .expect(200);
    expect(locked.body.status).toBe('LOCKED');
    await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(401);
    const login = await http()
      .post('/api/v1/auth/login')
      .send({ referenceNumber: '24900001', password: PASSWORD });
    expect(login.body.code).toBe('ACCOUNT_LOCKED');

    await asAdmin('post', `/api/v1/admin/students/${roster.id}/unlock`)
      .send({ reason: 'Resolved' })
      .expect(200);
    await http()
      .post('/api/v1/auth/login')
      .send({ referenceNumber: '24900001', password: PASSWORD })
      .expect(200);
    expect(await auditCount(ctx.prisma, roster.id)).toBe(2);
  });

  it('deactivating an unregistered student blocks registration', async () => {
    const roster = await ctx.prisma.collegeRosterEntry.findUniqueOrThrow({
      where: { referenceNumber: '24900003' },
    });
    await asAdmin('post', `/api/v1/admin/students/${roster.id}/deactivate`)
      .send({ reason: 'Left hostel' })
      .expect(200);
    const check = await http()
      .post('/api/v1/auth/roster-check')
      .send({ referenceNumber: '24900003' });
    expect(check.body.code).toBe('ROSTER_NOT_FOUND');
  });

  it('corrects college fields with a version check', async () => {
    const roster = await ctx.prisma.collegeRosterEntry.findUniqueOrThrow({
      where: { referenceNumber: '24900001' },
    });
    const updated = await asAdmin('patch', `/api/v1/admin/students/${roster.id}`)
      .send({ department: 'Mechanical', reason: 'Department transfer', rosterVersion: 1 })
      .expect(200);
    expect(updated.body).toMatchObject({ department: 'Mechanical', rosterVersion: 2 });
    const stale = await asAdmin('patch', `/api/v1/admin/students/${roster.id}`).send({
      department: 'Civil',
      reason: 'x',
      rosterVersion: 1,
    });
    expect(stale.status).toBe(409);
  });

  it('issues a one-time reset code that the student redeems (ADR-0019)', async () => {
    await http()
      .post('/api/v1/auth/register')
      .send({ referenceNumber: '24900001', password: PASSWORD, confirmPassword: PASSWORD })
      .expect(201);
    const roster = await ctx.prisma.collegeRosterEntry.findUniqueOrThrow({
      where: { referenceNumber: '24900001' },
    });
    const issued = await asAdmin('post', `/api/v1/admin/students/${roster.id}/credential-resets`)
      .send({ kind: 'PASSWORD', reason: 'Forgot password' })
      .expect(201);
    expect(issued.body.code).toMatch(/^[A-Z2-9]{10}$/);
    const audit = await ctx.prisma.auditLog.findFirstOrThrow({ where: { entityId: roster.id } });
    expect(JSON.stringify(audit)).not.toContain(issued.body.code);

    const newPassword = 'another-password-2';
    const wrong = await http()
      .post('/api/v1/auth/reset-with-code')
      .send({
        referenceNumber: '24900001',
        code: 'AAAAAAAAAA',
        password: newPassword,
        confirmPassword: newPassword,
      });
    expect(wrong.status).toBe(401);
    await http()
      .post('/api/v1/auth/reset-with-code')
      .send({
        referenceNumber: '24900001',
        code: issued.body.code.toLowerCase(),
        password: newPassword,
        confirmPassword: newPassword,
      })
      .expect(200);
    await http()
      .post('/api/v1/auth/login')
      .send({ referenceNumber: '24900001', password: newPassword })
      .expect(200);
    const reuse = await http()
      .post('/api/v1/auth/reset-with-code')
      .send({
        referenceNumber: '24900001',
        code: issued.body.code,
        password: newPassword,
        confirmPassword: newPassword,
      });
    expect(reuse.status).toBe(401);
  });
});
