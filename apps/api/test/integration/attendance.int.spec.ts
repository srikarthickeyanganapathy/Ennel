import { addBusinessDays, toBusinessDate, toInstant } from '@ennel/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CloseAttendanceWindowsService } from '../../src/modules/jobs/services/close-attendance-windows.service';
import { resetDatabase, seedFixtures } from './helpers/database';
import { seedRoles, staffToken } from './helpers/staff';
import { createTestApp, type TestApp } from './helpers/test-app';

const PASSWORD = 'correct-horse-1';
const STUDENT = '24900001';

describe('attendance and My Bookings (Spec §7, Admin §I, BR-ATT, BR-NS-1/7, ADR-0025)', () => {
  let ctx: TestApp;
  let student: string;
  let counterStaff: string;
  let manager: string;
  let tomorrow: string;
  let lunch: { start: number; end: number; grace: number };
  const http = () => request(ctx.app.getHttpServer());
  const as = (token: string, method: 'get' | 'post', path: string) =>
    http()[method](path).set('Authorization', `Bearer ${token}`);
  const window = () => ({ date: tomorrow, mealType: 'LUNCH' });
  const duringLunch = () => ctx.clock.set(toInstant(tomorrow, lunch.start + 10));
  const afterLunch = () => ctx.clock.set(toInstant(tomorrow, lunch.end + lunch.grace + 5));
  const lunchBooking = () =>
    ctx.prisma.booking.findFirstOrThrow({
      where: { meal: { mealType: 'LUNCH' }, mealDate: new Date(`${tomorrow}T00:00:00Z`) },
      include: { attendanceRecord: true, noShowEvent: true },
    });
  const closeWindows = () => ctx.app.get(CloseAttendanceWindowsService).run();

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    await seedFixtures(ctx.prisma);
    await seedRoles(ctx.prisma);
    ctx.rateLimiter.reset();
    ctx.attendanceProvider.reset();
    ctx.clock.set(new Date());
    tomorrow = addBusinessDays(toBusinessDate(ctx.clock.now()), 1);
    const meal = await ctx.prisma.meal.findUniqueOrThrow({
      where: { mealType: 'LUNCH' },
      include: { slots: { orderBy: { startMinute: 'asc' } } },
    });
    lunch = {
      start: meal.serviceStartMinute,
      end: meal.serviceEndMinute,
      grace: meal.attendanceGraceMinutes,
    };
    counterStaff = await staffToken(ctx, ['MESS_STAFF']);
    manager = await staffToken(ctx, ['MESS_MANAGER']);
    const session = await http()
      .post('/api/v1/auth/register')
      .send({ referenceNumber: STUDENT, password: PASSWORD, confirmPassword: PASSWORD })
      .expect(201);
    student = session.body.accessToken as string;
    const block = await ctx.prisma.hostelBlock.findFirstOrThrow();
    await http()
      .put('/api/v1/me/onboarding')
      .set('Authorization', `Bearer ${student}`)
      .send({
        profile: {
          hostelBlockId: block.id,
          roomNumber: '101',
          phone: '9000000001',
          parentPhone: '9000000002',
        },
        defaultBookingEnabled: true,
        mealPreferences: [
          { mealType: 'BREAKFAST', isEnabled: false, slotId: null, dietType: 'VEG' },
          { mealType: 'LUNCH', isEnabled: true, slotId: meal.slots[0]?.id, dietType: 'VEG' },
          { mealType: 'DINNER', isEnabled: false, slotId: null, dietType: 'VEG' },
        ],
      })
      .expect(200);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('marks a booked student present once, completing the meal, and needs a reason without a booking', async () => {
    duringLunch();
    const before = await as(counterStaff, 'get', '/api/v1/admin/attendance/counter')
      .query(window())
      .expect(200);
    expect(before.body).toMatchObject({ phase: 'OPEN', totals: { booked: 1, attended: 0 } });

    const lookup = await as(counterStaff, 'get', '/api/v1/admin/attendance/lookup')
      .query({ ...window(), referenceNumber: '24 900 001' })
      .expect(200);
    expect(lookup.body).toMatchObject({ canMark: true, needsReason: false });

    const marked = await as(counterStaff, 'post', '/api/v1/admin/attendance/marks')
      .send({ ...window(), referenceNumber: STUDENT })
      .expect(201);
    expect(marked.body).toMatchObject({
      canMark: false,
      attendance: { source: 'MANUAL_FALLBACK', verifiedAt: null },
      booking: { status: 'COMPLETED' },
    });
    await as(counterStaff, 'post', '/api/v1/admin/attendance/marks')
      .send({ ...window(), referenceNumber: STUDENT })
      .expect(400);
    const after = await as(counterStaff, 'get', '/api/v1/admin/attendance/counter')
      .query(window())
      .expect(200);
    expect(after.body.totals.attended).toBe(1);
    expect(after.body.recent[0]).toMatchObject({
      referenceNumber: STUDENT,
      source: 'MANUAL_FALLBACK',
    });

    // A second student with an account but no booking for this meal.
    await http()
      .post('/api/v1/auth/register')
      .send({ referenceNumber: '24900002', password: PASSWORD, confirmPassword: PASSWORD })
      .expect(201);
    await as(counterStaff, 'post', '/api/v1/admin/attendance/marks')
      .send({ ...window(), referenceNumber: '24900002' })
      .expect(422);
    await as(counterStaff, 'post', '/api/v1/admin/attendance/marks')
      .send({ ...window(), referenceNumber: '24900002', reason: 'Guest pass from the warden' })
      .expect(201);
    const override = await ctx.prisma.auditLog.findFirstOrThrow({
      where: { action: 'attendance.mark', isOverride: true },
    });
    expect(override.reason).toBe('Guest pass from the warden');
  });

  it('refuses marking outside the window and keeps outage mode to staff allowed to toggle it', async () => {
    afterLunch();
    const late = await as(counterStaff, 'post', '/api/v1/admin/attendance/marks')
      .send({ ...window(), referenceNumber: STUDENT })
      .expect(400);
    expect(late.body.message).toMatch(/window has closed/);
    await as(counterStaff, 'post', '/api/v1/admin/attendance/outage/start')
      .send({ reason: 'Camera offline' })
      .expect(403);
  });

  it('closes the window once: face verifications complete meals, missing ones become No-shows', async () => {
    afterLunch();
    let summary = await closeWindows();
    expect(summary.closed).toContain(`${tomorrow}:LUNCH`);
    const missed = await lunchBooking();
    expect(missed.status).toBe('NO_SHOW');
    expect(missed.noShowEvent?.status).toBe('COUNTED');
    summary = await closeWindows();
    expect(summary.closed).not.toContain(`${tomorrow}:LUNCH`);

    const history = await as(student, 'get', '/api/v1/bookings/history')
      .query({ status: 'NO_SHOW' })
      .expect(200);
    expect(history.body.items).toHaveLength(1);
    const record = await as(student, 'get', `/api/v1/bookings/${missed.id}/record`).expect(200);
    expect(record.body).toMatchObject({
      status: 'NO_SHOW',
      attendance: null,
      noShow: { status: 'COUNTED' },
    });
    const other = await staffToken(ctx, ['WARDEN']);
    await as(other, 'get', `/api/v1/bookings/${missed.id}/record`).expect(401);
  });

  it('hides the face-verification simulator outside development', async () => {
    duringLunch();
    await http().post('/api/v1/dev/attendance').send({ referenceNumber: STUDENT }).expect(404);
  });

  it('records face verification time only from the provider', async () => {
    const verifiedAt = toInstant(tomorrow, lunch.start + 7);
    ctx.attendanceProvider.set(tomorrow, 'LUNCH', [{ referenceNumber: STUDENT, verifiedAt }]);
    afterLunch();
    await closeWindows();
    const booking = await lunchBooking();
    expect(booking.status).toBe('COMPLETED');
    expect(booking.attendanceRecord).toMatchObject({ source: 'FACE_VERIFICATION', verifiedAt });

    const history = await as(student, 'get', '/api/v1/bookings/history')
      .query({ status: 'COMPLETED', mealType: 'LUNCH' })
      .expect(200);
    expect(history.body.items[0].attendance).toMatchObject({
      source: 'FACE_VERIFICATION',
      verifiedAt: verifiedAt.toISOString(),
    });
  });

  it('holds No-shows during an outage and lets an import clear them (BR-NS-7)', async () => {
    duringLunch();
    await as(manager, 'post', '/api/v1/admin/attendance/outage/start')
      .send({ reason: 'Camera offline' })
      .expect(200);
    await as(manager, 'post', '/api/v1/admin/attendance/outage/start')
      .send({ reason: 'Again' })
      .expect(400);
    afterLunch();
    await closeWindows();
    expect((await lunchBooking()).noShowEvent?.status).toBe('HELD_FOR_REVIEW');
    const ended = await as(manager, 'post', '/api/v1/admin/attendance/outage/end')
      .send({ reason: 'Camera fixed' })
      .expect(200);
    expect(ended.body.active).toBeNull();

    const csv = Buffer.from(`reference_number\n${STUDENT}\n99999999\n${STUDENT}\n`);
    const preview = await as(manager, 'post', '/api/v1/admin/attendance/imports')
      .query(window())
      .attach('file', csv, { filename: 'lunch.csv', contentType: 'text/csv' })
      .expect(201);
    expect(preview.body).toMatchObject({ status: 'VALIDATED', validRows: 1, invalidRows: 2 });
    expect(preview.body.rows.map((row: { outcome: string }) => row.outcome)).toEqual([
      'VALID',
      'INVALID',
      'DUPLICATE_IN_FILE',
    ]);
    const confirmed = await as(
      manager,
      'post',
      `/api/v1/admin/attendance/imports/${preview.body.id}/confirm`,
    ).expect(200);
    expect(confirmed.body).toMatchObject({ status: 'COMPLETED', appliedRows: 1 });
    const booking = await lunchBooking();
    expect(booking).toMatchObject({ status: 'COMPLETED' });
    expect(booking.noShowEvent).toMatchObject({
      status: 'EXCLUDED',
      exclusionCause: 'OUTAGE_REVIEW_DISMISSED',
    });
    expect(booking.attendanceRecord).toMatchObject({ source: 'IMPORT', verifiedAt: null });
    await as(manager, 'post', `/api/v1/admin/attendance/imports/${preview.body.id}/confirm`).expect(
      400,
    );
  });
});
