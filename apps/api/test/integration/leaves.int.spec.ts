import { randomUUID } from 'node:crypto';
import { addBusinessDays, toBusinessDate } from '@ennel/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase, seedFixtures } from './helpers/database';
import { seedRoles, staffToken } from './helpers/staff';
import { createTestApp, type TestApp } from './helpers/test-app';

const PASSWORD = 'correct-horse-1';

describe('leave (Spec §11, Admin §K, BR-LEAVE, ADR-0007, ADR-0026)', () => {
  let ctx: TestApp;
  let token: string;
  let studentId: string;
  let day1: string;
  let day2: string;
  let day3: string;
  const http = () => request(ctx.app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const range = (
    start: string,
    end: string,
    startMealType = 'BREAKFAST',
    endMealType = 'DINNER',
  ) => ({
    startDate: start,
    startMealType,
    endDate: end,
    endMealType,
  });
  const apply = (body: object, key = randomUUID()) =>
    http().post('/api/v1/leaves').set(auth()).set('Idempotency-Key', key).send(body);
  const lunchStatus = async (date: string) =>
    (
      await ctx.prisma.booking.findFirstOrThrow({
        where: { studentId, meal: { mealType: 'LUNCH' }, mealDate: new Date(`${date}T00:00:00Z`) },
      })
    ).status;
  const lunchCard = async (date: string) =>
    (await http().get(`/api/v1/days/${date}`).set(auth()).expect(200)).body.meals.find(
      (meal: { mealType: string }) => meal.mealType === 'LUNCH',
    );

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    await seedFixtures(ctx.prisma);
    await seedRoles(ctx.prisma);
    ctx.rateLimiter.reset();
    ctx.clock.set(new Date());
    const today = toBusinessDate(ctx.clock.now());
    [day1, day2, day3] = [1, 2, 3].map((offset) => addBusinessDays(today, offset)) as [
      string,
      string,
      string,
    ];
    const session = await http()
      .post('/api/v1/auth/register')
      .send({ referenceNumber: '24900001', password: PASSWORD, confirmPassword: PASSWORD })
      .expect(201);
    token = session.body.accessToken as string;
    const block = await ctx.prisma.hostelBlock.findFirstOrThrow();
    const lunch = await ctx.prisma.mealSlot.findFirstOrThrow({
      where: { meal: { mealType: 'LUNCH' } },
      orderBy: { startMinute: 'asc' },
    });
    await http()
      .put('/api/v1/me/onboarding')
      .set(auth())
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
          { mealType: 'LUNCH', isEnabled: true, slotId: lunch.id, dietType: 'VEG' },
          { mealType: 'DINNER', isEnabled: false, slotId: null, dietType: 'VEG' },
        ],
      })
      .expect(200);
    studentId = (await ctx.prisma.student.findFirstOrThrow()).id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('previews, applies at once and pauses booked meals; replays and overlaps are handled', async () => {
    const preview = await http()
      .post('/api/v1/leaves/preview')
      .set(auth())
      .send(range(day1, day2))
      .expect(200);
    expect(preview.body).toMatchObject({
      days: 2,
      meals: 6,
      status: 'APPROVED',
      bookingsToPause: 2,
      problem: null,
    });

    const key = randomUUID();
    const applied = await apply(range(day1, day2), key).expect(201);
    expect(applied.body).toMatchObject({
      leave: { status: 'APPROVED', state: 'UPCOMING' },
      bookingsPaused: 2,
    });
    expect((await apply(range(day1, day2), key).expect(201)).body.leave.id).toBe(
      applied.body.leave.id,
    );
    expect(await lunchStatus(day1)).toBe('PAUSED_LEAVE');
    expect((await lunchCard(day2)).label).toBe('PAUSED_LEAVE');
    expect(await lunchStatus(day3)).toBe('BOOKED');

    const list = await http().get('/api/v1/leaves').set(auth()).expect(200);
    expect(list.body.current).toMatchObject({
      status: 'UPCOMING',
      leave: { id: applied.body.leave.id },
    });

    expect((await apply(range(day2, day3)).expect(422)).body.code).toBe('LEAVE_RANGE_INVALID');
    expect((await apply(range(day3, day2)).expect(422)).body.code).toBe('LEAVE_RANGE_INVALID');
    const past = addBusinessDays(day1, -3);
    expect((await apply(range(past, past)).expect(422)).body.message).toMatch(
      /can still be cancelled/,
    );
  });

  it('ends early from a resume point, and withdrawing before the start cancels the leave', async () => {
    const leave = (await apply(range(day1, day3)).expect(201)).body.leave;
    const ended = await http()
      .post(`/api/v1/leaves/${leave.id}/end`)
      .set(auth())
      .send({ resumeDate: day2, resumeMealType: 'BREAKFAST', version: leave.version })
      .expect(200);
    expect(ended.body).toMatchObject({
      leave: { endDate: day1, endMealType: 'DINNER' },
      bookingsResumed: 2,
    });
    expect(await lunchStatus(day1)).toBe('PAUSED_LEAVE');
    expect(await lunchStatus(day2)).toBe('BOOKED');

    const withdrawn = await http()
      .post(`/api/v1/leaves/${leave.id}/end`)
      .set(auth())
      .send({ resumeDate: day1, resumeMealType: 'BREAKFAST', version: ended.body.leave.version })
      .expect(200);
    expect(withdrawn.body.leave).toMatchObject({
      status: 'CANCELLED',
      state: 'CANCELLED',
      canChange: false,
    });
    expect(await lunchStatus(day1)).toBe('BOOKED');
    await http()
      .post(`/api/v1/leaves/${leave.id}/end`)
      .set(auth())
      .send({ resumeDate: day1, resumeMealType: 'BREAKFAST', version: leave.version })
      .expect(400);
  });

  it('extends an approved leave and pauses the added meals', async () => {
    const leave = (await apply(range(day1, day1)).expect(201)).body.leave;
    const extended = await http()
      .post(`/api/v1/leaves/${leave.id}/extend`)
      .set(auth())
      .send({ endDate: day2, endMealType: 'DINNER', version: leave.version })
      .expect(200);
    expect(extended.body).toMatchObject({
      leave: { endDate: day2 },
      extensionRequest: null,
      bookingsPaused: 1,
    });
    expect(await lunchStatus(day2)).toBe('PAUSED_LEAVE');
    await http()
      .post(`/api/v1/leaves/${leave.id}/extend`)
      .set(auth())
      .send({ endDate: day1, endMealType: 'DINNER', version: extended.body.leave.version })
      .expect(422);
  });

  it('waits for approval when required, then pauses on approval and notifies (ADR-0007)', async () => {
    await ctx.prisma.messPolicy.update({ where: { id: 1 }, data: { leaveRequiresApproval: true } });
    const pending = (await apply(range(day1, day1)).expect(201)).body.leave;
    expect(pending).toMatchObject({ status: 'PENDING', state: 'PENDING' });
    expect(await lunchStatus(day1)).toBe('BOOKED');

    const warden = await staffToken(ctx, ['WARDEN']);
    const queue = await http()
      .get('/api/v1/admin/leaves')
      .query({ status: 'PENDING' })
      .set('Authorization', `Bearer ${warden}`)
      .expect(200);
    expect(queue.body).toMatchObject({ pendingCount: 1, requiresApproval: true });
    expect(queue.body.items[0].student.referenceNumber).toBe('24900001');

    const approved = await http()
      .post(`/api/v1/admin/leaves/${pending.id}/approve`)
      .set('Authorization', `Bearer ${warden}`)
      .send({ version: pending.version })
      .expect(200);
    expect(approved.body).toMatchObject({ leave: { status: 'APPROVED' }, bookingsPaused: 1 });
    expect(await lunchStatus(day1)).toBe('PAUSED_LEAVE');
    expect(
      await ctx.prisma.notification.count({ where: { studentId, title: 'Leave approved' } }),
    ).toBe(1);
    expect(
      await ctx.prisma.auditLog.count({ where: { entityId: pending.id, action: 'leave.approve' } }),
    ).toBe(1);

    const extended = await http()
      .post(`/api/v1/leaves/${pending.id}/extend`)
      .set(auth())
      .send({ endDate: day2, endMealType: 'DINNER', version: approved.body.leave.version })
      .expect(200);
    expect(extended.body.extensionRequest).toMatchObject({ status: 'PENDING', startDate: day2 });
    expect(await lunchStatus(day2)).toBe('BOOKED');

    await http()
      .post(`/api/v1/admin/leaves/${extended.body.extensionRequest.id}/reject`)
      .set('Authorization', `Bearer ${warden}`)
      .send({ version: 1 })
      .expect(400);
    const rejected = await http()
      .post(`/api/v1/admin/leaves/${extended.body.extensionRequest.id}/reject`)
      .set('Authorization', `Bearer ${warden}`)
      .send({ version: 1, reason: 'Exams that week' })
      .expect(200);
    expect(rejected.body.leave).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Exams that week',
    });
  });

  it('lets managers create a leave on a student’s behalf, audited, but not wardens', async () => {
    const warden = await staffToken(ctx, ['WARDEN']);
    const body = { ...range(day1, day1), studentId, reason: 'Medical leave from the warden' };
    await http()
      .post('/api/v1/admin/leaves')
      .set('Authorization', `Bearer ${warden}`)
      .send(body)
      .expect(403);
    const manager = await staffToken(ctx, ['MESS_MANAGER']);
    const created = await http()
      .post('/api/v1/admin/leaves')
      .set('Authorization', `Bearer ${manager}`)
      .send(body)
      .expect(201);
    expect(created.body.leave).toMatchObject({ status: 'APPROVED', isCreatedByStaff: true });
    expect(await lunchStatus(day1)).toBe('PAUSED_LEAVE');
    const entry = await ctx.prisma.auditLog.findFirstOrThrow({ where: { action: 'leave.create' } });
    expect(entry).toMatchObject({ isOverride: true, reason: 'Medical leave from the warden' });

    const corrected = await http()
      .patch(`/api/v1/admin/leaves/${created.body.leave.id}`)
      .set('Authorization', `Bearer ${manager}`)
      .send({
        ...range(day2, day2),
        version: created.body.leave.version,
        reason: 'Dates were wrong',
      })
      .expect(200);
    expect(corrected.body).toMatchObject({ bookingsPaused: 1, bookingsResumed: 1 });
    expect(await lunchStatus(day1)).toBe('BOOKED');
    expect(await lunchStatus(day2)).toBe('PAUSED_LEAVE');
  });
});
