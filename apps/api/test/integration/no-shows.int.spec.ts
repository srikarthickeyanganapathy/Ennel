import { addBusinessDays, toBusinessDate } from '@ennel/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CloseAttendanceWindowsService } from '../../src/modules/jobs/services/close-attendance-windows.service';
import { resetDatabase, seedFixtures } from './helpers/database';
import { seedRoles, staffToken } from './helpers/staff';
import { createTestApp, type TestApp } from './helpers/test-app';

const PASSWORD = 'correct-horse-1';

describe('no-shows and appeals (Spec §10, Admin §J, BR-NS, ADR-0009, ADR-0027)', () => {
  let ctx: TestApp;
  let token: string;
  let studentId: string;
  let today: string;
  let lunch: { mealId: string; slotId: string };
  const http = () => request(ctx.app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const summary = async () =>
    (await http().get('/api/v1/no-shows/summary').set(auth()).expect(200)).body;
  const lunchSummary = async () =>
    (await summary()).meals.find((meal: { mealType: string }) => meal.mealType === 'LUNCH');
  const tomorrowLunch = () =>
    ctx.prisma.booking.findFirstOrThrow({
      where: {
        studentId,
        mealId: lunch.mealId,
        mealDate: new Date(`${addBusinessDays(today, 1)}T00:00:00Z`),
      },
    });

  /** A past lunch that was missed, as the window closer would have left it. */
  async function seedNoShow(daysAgo: number, status: 'COUNTED' | 'HELD_FOR_REVIEW' = 'COUNTED') {
    const mealDate = new Date(`${addBusinessDays(today, -daysAgo)}T00:00:00Z`);
    const booking = await ctx.prisma.booking.create({
      data: {
        studentId,
        mealDate,
        mealId: lunch.mealId,
        slotId: lunch.slotId,
        dietType: 'VEG',
        source: 'DEFAULT',
        status: 'NO_SHOW',
        lastActorType: 'SYSTEM',
      },
    });
    return ctx.prisma.noShowEvent.create({
      data: { bookingId: booking.id, studentId, mealDate, mealType: 'LUNCH', status },
    });
  }

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
    today = toBusinessDate(ctx.clock.now());
    const session = await http()
      .post('/api/v1/auth/register')
      .send({ referenceNumber: '24900001', password: PASSWORD, confirmPassword: PASSWORD })
      .expect(201);
    token = session.body.accessToken as string;
    const block = await ctx.prisma.hostelBlock.findFirstOrThrow();
    const slot = await ctx.prisma.mealSlot.findFirstOrThrow({
      where: { meal: { mealType: 'LUNCH' } },
      orderBy: { startMinute: 'asc' },
    });
    lunch = { mealId: slot.mealId, slotId: slot.id };
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
          { mealType: 'LUNCH', isEnabled: true, slotId: slot.id, dietType: 'VEG' },
          { mealType: 'DINNER', isEnabled: false, slotId: null, dietType: 'VEG' },
        ],
      })
      .expect(200);
    studentId = (await ctx.prisma.student.findFirstOrThrow()).id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('counts only the rolling window and warns from three (Spec §10)', async () => {
    for (const daysAgo of [3, 4, 5]) await seedNoShow(daysAgo);
    await seedNoShow(40);
    await seedNoShow(6, 'HELD_FOR_REVIEW');
    expect(await lunchSummary()).toMatchObject({
      count: 3,
      level: 'WARNING',
      remainingBeforeDisable: 2,
      isAutoDisabled: false,
    });
    const events = (await summary()).events;
    expect(events).toHaveLength(4);
    expect(events.every((event: { canAppeal: boolean }) => event.canAppeal)).toBe(true);
  });

  it('lists students at the warning level as at risk, not those below it or disabled (BR-NS-4)', async () => {
    const manager = await staffToken(ctx, ['MESS_MANAGER']);
    const atRisk = async () =>
      (
        await http()
          .get('/api/v1/admin/no-shows/at-risk')
          .set('Authorization', `Bearer ${manager}`)
          .expect(200)
      ).body;
    for (const daysAgo of [3, 4]) await seedNoShow(daysAgo);
    expect(await atRisk()).toMatchObject({ warningThreshold: 3, disableThreshold: 5, total: 0 });

    await seedNoShow(5);
    await seedNoShow(40); // Outside the rolling window.
    expect((await atRisk()).items).toEqual([
      {
        student: expect.objectContaining({ id: studentId, referenceNumber: '24900001' }),
        mealType: 'LUNCH',
        count: 3,
      },
    ]);

    for (const daysAgo of [6, 7]) await seedNoShow(daysAgo);
    expect((await atRisk()).total).toBe(0);

    const staff = await staffToken(ctx, ['MESS_STAFF']);
    await http()
      .get('/api/v1/admin/no-shows/at-risk')
      .set('Authorization', `Bearer ${staff}`)
      .expect(403);
  });

  it('turns Default Booking off at five when a window closes, and lifts it after an approved appeal', async () => {
    const events = [];
    for (const daysAgo of [3, 4, 5, 6]) events.push(await seedNoShow(daysAgo));
    // Yesterday's lunch was booked and missed; the closer records the fifth No-show.
    const yesterday = addBusinessDays(today, -1);
    await ctx.prisma.booking.upsert({
      where: {
        studentId_mealDate_mealId: {
          studentId,
          mealDate: new Date(`${yesterday}T00:00:00Z`),
          mealId: lunch.mealId,
        },
      },
      create: {
        studentId,
        mealDate: new Date(`${yesterday}T00:00:00Z`),
        mealId: lunch.mealId,
        slotId: lunch.slotId,
        dietType: 'VEG',
        source: 'DEFAULT',
        status: 'BOOKED',
        lastActorType: 'SYSTEM',
      },
      update: { status: 'BOOKED' },
    });
    await ctx.app.get(CloseAttendanceWindowsService).run();

    expect(await lunchSummary()).toMatchObject({
      count: 5,
      level: 'DISABLED',
      isAutoDisabled: true,
      canReEnable: false,
    });
    expect((await tomorrowLunch()).status).toBe('CANCELLED');
    expect(
      await ctx.prisma.notification.count({
        where: { studentId, title: 'Default Booking turned off for Lunch' },
      }),
    ).toBe(1);
    await http().post('/api/v1/no-shows/meals/LUNCH/re-enable').set(auth()).expect(400);

    const reported = await http()
      .post(`/api/v1/no-shows/${events[0]!.id}/appeals`)
      .set(auth())
      .send({ message: 'I ate lunch; the camera did not see me.' })
      .expect(201);
    expect(reported.body).toMatchObject({ canAppeal: false, appeal: { status: 'PENDING' } });
    await http()
      .post(`/api/v1/no-shows/${events[0]!.id}/appeals`)
      .set(auth())
      .send({ message: 'Again please' })
      .expect(400);

    const manager = await staffToken(ctx, ['MESS_MANAGER']);
    const queue = await http()
      .get('/api/v1/admin/no-shows')
      .query({ appeal: 'PENDING' })
      .set('Authorization', `Bearer ${manager}`)
      .expect(200);
    expect(queue.body).toMatchObject({ pendingAppeals: 1, total: 1 });
    expect(queue.body.items[0]).toMatchObject({ currentCount: 5, isAutoDisabled: true });

    const approved = await http()
      .post(`/api/v1/admin/no-show-appeals/${reported.body.appeal.id}/approve`)
      .set('Authorization', `Bearer ${manager}`)
      .send({})
      .expect(200);
    expect(approved.body).toEqual({ changed: 1, count: 4, isAutoDisabled: false });
    expect((await tomorrowLunch()).status).toBe('BOOKED');
    expect(await ctx.prisma.notification.count({ where: { studentId, category: 'NO_SHOW' } })).toBe(
      3,
    );
    expect(
      await ctx.prisma.auditLog.count({
        where: { action: 'no-show.appeal.approve', entityId: reported.body.appeal.id },
      }),
    ).toBe(1);
  });

  it('rejects an appeal only with a reason and tells the student', async () => {
    const event = await seedNoShow(2);
    const appeal = await http()
      .post(`/api/v1/no-shows/${event.id}/appeals`)
      .set(auth())
      .send({ message: 'I was at the counter.' })
      .expect(201);
    const manager = await staffToken(ctx, ['MESS_MANAGER']);
    const path = `/api/v1/admin/no-show-appeals/${appeal.body.appeal.id}/reject`;
    await http().post(path).set('Authorization', `Bearer ${manager}`).send({}).expect(400);
    await http()
      .post(path)
      .set('Authorization', `Bearer ${manager}`)
      .send({ reason: 'Counter log shows no visit' })
      .expect(200);
    const after = (await summary()).events[0];
    expect(after).toMatchObject({
      status: 'COUNTED',
      appeal: { status: 'REJECTED', decisionReason: 'Counter log shows no visit' },
    });
  });

  it('confirms or dismisses No-shows held during an outage (BR-NS-7)', async () => {
    const confirm = await seedNoShow(2, 'HELD_FOR_REVIEW');
    const dismiss = await seedNoShow(3, 'HELD_FOR_REVIEW');
    const manager = await staffToken(ctx, ['MESS_MANAGER']);
    const held = await http()
      .get('/api/v1/admin/no-shows')
      .query({ status: 'HELD_FOR_REVIEW' })
      .set('Authorization', `Bearer ${manager}`)
      .expect(200);
    expect(held.body.heldForReview).toBe(2);

    const confirmed = await http()
      .post(`/api/v1/admin/no-shows/${confirm.id}/confirm`)
      .set('Authorization', `Bearer ${manager}`)
      .send({ reason: 'Manual log shows no visit' })
      .expect(200);
    expect(confirmed.body).toMatchObject({ count: 1 });
    await http()
      .post(`/api/v1/admin/no-shows/${dismiss.id}/dismiss`)
      .set('Authorization', `Bearer ${manager}`)
      .send({ reason: 'Camera was down all lunch' })
      .expect(200);
    await http()
      .post(`/api/v1/admin/no-shows/${dismiss.id}/dismiss`)
      .set('Authorization', `Bearer ${manager}`)
      .send({ reason: 'Again' })
      .expect(400);
    expect((await lunchSummary()).count).toBe(1);
  });

  it('lets managers reset a count and re-enable Default Booking, but not wardens', async () => {
    for (const daysAgo of [2, 3, 4, 5, 6]) await seedNoShow(daysAgo);
    const mealId = lunch.mealId;
    await ctx.prisma.mealPreference.update({
      where: { studentId_mealId: { studentId, mealId } },
      data: { autoDisabledAt: new Date() },
    });
    const warden = await staffToken(ctx, ['WARDEN']);
    await http()
      .post(`/api/v1/admin/students/${studentId}/no-shows/reset`)
      .set('Authorization', `Bearer ${warden}`)
      .send({ mealType: 'LUNCH', reason: 'x' })
      .expect(403);

    const manager = await staffToken(ctx, ['MESS_MANAGER']);
    const reset = await http()
      .post(`/api/v1/admin/students/${studentId}/no-shows/reset`)
      .set('Authorization', `Bearer ${manager}`)
      .send({ mealType: 'LUNCH', reason: 'Warden confirmed medical issue' })
      .expect(200);
    expect(reset.body).toEqual({ changed: 5, count: 0, isAutoDisabled: true });
    expect((await lunchSummary()).canReEnable).toBe(true);

    const reEnabled = await http()
      .post(`/api/v1/admin/students/${studentId}/default-booking/re-enable`)
      .set('Authorization', `Bearer ${manager}`)
      .send({ mealType: 'LUNCH', reason: 'Back to normal' })
      .expect(200);
    expect(reEnabled.body).toMatchObject({ isAutoDisabled: false });
    expect((await tomorrowLunch()).status).toBe('BOOKED');
    const entries = await ctx.prisma.auditLog.findMany({
      where: { action: { startsWith: 'no-show.' }, entityId: studentId },
    });
    expect(entries.map((entry) => entry.action).sort()).toEqual([
      'no-show.default-booking.re-enable',
      'no-show.reset',
    ]);
    expect(entries.every((entry) => entry.isOverride)).toBe(true);
  });
});
