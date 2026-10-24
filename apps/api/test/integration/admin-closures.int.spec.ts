import { randomUUID } from 'node:crypto';
import { addBusinessDays, toBusinessDate } from '@ennel/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase, seedFixtures } from './helpers/database';
import { seedRoles, staffToken } from './helpers/staff';
import { createTestApp, type TestApp } from './helpers/test-app';

const PASSWORD = 'correct-horse-1';

describe('closures (Admin §F, BR-CLOS, ADR-0017)', () => {
  let ctx: TestApp;
  let student: string;
  let manager: string;
  let tomorrow: string;
  const http = () => request(ctx.app.getHttpServer());
  const asManager = (method: 'get' | 'post', path: string) =>
    http()[method](path).set('Authorization', `Bearer ${manager}`);
  const lunchCard = async () =>
    (
      await http()
        .get(`/api/v1/days/${tomorrow}`)
        .set('Authorization', `Bearer ${student}`)
        .expect(200)
    ).body.meals.find((meal: { mealType: string }) => meal.mealType === 'LUNCH');
  const closeLunch = (overrides: Record<string, unknown> = {}) =>
    asManager('post', '/api/v1/admin/closures').send({
      date: tomorrow,
      mealTypes: ['LUNCH'],
      kind: 'MAINTENANCE',
      title: 'Kitchen repairs',
      reason: 'Gas line work',
      ...overrides,
    });

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    await seedFixtures(ctx.prisma);
    await seedRoles(ctx.prisma);
    ctx.rateLimiter.reset();
    ctx.clock.set(new Date());
    tomorrow = addBusinessDays(toBusinessDate(ctx.clock.now()), 1);
    manager = await staffToken(ctx, ['MESS_MANAGER']);
    const session = await http()
      .post('/api/v1/auth/register')
      .send({ referenceNumber: '24900001', password: PASSWORD, confirmPassword: PASSWORD })
      .expect(201);
    student = session.body.accessToken as string;
    const slot = await ctx.prisma.mealSlot.findFirstOrThrow({
      where: { meal: { mealType: 'LUNCH' } },
      orderBy: { startMinute: 'asc' },
    });
    await http()
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${student}`)
      .set('Idempotency-Key', randomUUID())
      .send({ date: tomorrow, mealType: 'LUNCH', slotId: slot.id, dietType: 'VEG' })
      .expect(201);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('previews the impact, cancels booked meals as Mess closed and notifies students', async () => {
    const impact = await asManager('get', '/api/v1/admin/closures/impact')
      .query({ date: tomorrow, mealTypes: 'LUNCH,DINNER' })
      .expect(200);
    expect(impact.body).toEqual({
      meals: [
        { mealType: 'LUNCH', bookedCount: 1 },
        { mealType: 'DINNER', bookedCount: 0 },
      ],
      totalBooked: 1,
    });

    const created = await closeLunch().expect(201);
    expect(created.body).toMatchObject({
      cancelled: 1,
      closure: { status: 'ACTIVE', mealTypes: ['LUNCH'], kind: 'MAINTENANCE' },
    });
    expect((await lunchCard()).label).toBe('MESS_CLOSED');
    const notice = await ctx.prisma.notification.findFirstOrThrow({
      where: { relatedEntityId: created.body.closure.id },
    });
    expect(notice.title).toMatch(/^Mess closed: Lunch on /);
    expect(
      await ctx.prisma.auditLog.count({
        where: { entityId: created.body.closure.id, action: 'closure.create' },
      }),
    ).toBe(1);

    const slot = await ctx.prisma.mealSlot.findFirstOrThrow({
      where: { meal: { mealType: 'LUNCH' } },
      orderBy: { startMinute: 'desc' },
    });
    const rebook = await http()
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${student}`)
      .set('Idempotency-Key', randomUUID())
      .send({ date: tomorrow, mealType: 'LUNCH', slotId: slot.id, dietType: 'VEG' })
      .expect(422);
    expect(rebook.body.code).toBe('BOOKING_NOT_ALLOWED');
  });

  it('refuses a second closure for the same meal and dates in the past', async () => {
    await closeLunch().expect(201);
    expect((await closeLunch({ mealTypes: ['LUNCH', 'DINNER'] }).expect(400)).body.message).toBe(
      'Lunch is already closed on this date.',
    );
    await closeLunch({ date: addBusinessDays(tomorrow, -2) }).expect(400);
  });

  it('restores bookings when the closure is removed and tells the student', async () => {
    const created = await closeLunch().expect(201);
    const removed = await asManager(
      'post',
      `/api/v1/admin/closures/${created.body.closure.id}/remove`,
    )
      .send({ reason: 'Repairs done early' })
      .expect(200);
    expect(removed.body).toMatchObject({
      restored: 1,
      notRestored: 0,
      closure: { status: 'REMOVED', removalReason: 'Repairs done early' },
    });
    expect((await lunchCard()).booking.status).toBe('BOOKED');
    const reopened = await ctx.prisma.notification.findFirstOrThrow({
      where: { dedupeKey: { startsWith: `closure-removed:${created.body.closure.id}` } },
    });
    expect(reopened.body).toMatch(/your booking is restored/);
    await asManager('post', `/api/v1/admin/closures/${created.body.closure.id}/remove`)
      .send({ reason: 'again' })
      .expect(400);

    const list = await asManager('get', '/api/v1/admin/closures')
      .query({ includeRemoved: 'false' })
      .expect(200);
    expect(list.body.items).toHaveLength(0);
    expect(
      (
        await asManager('get', '/api/v1/admin/closures')
          .query({ includeRemoved: 'true' })
          .expect(200)
      ).body.items,
    ).toHaveLength(1);
  });

  it('lets Mess Staff see closures but not create them', async () => {
    const kitchen = await staffToken(ctx, ['MESS_STAFF']);
    await http()
      .get('/api/v1/admin/closures')
      .set('Authorization', `Bearer ${kitchen}`)
      .expect(200);
    await http()
      .post('/api/v1/admin/closures')
      .set('Authorization', `Bearer ${kitchen}`)
      .send({
        date: tomorrow,
        mealTypes: ['LUNCH'],
        kind: 'MAINTENANCE',
        title: 'x y',
        reason: 'z',
      })
      .expect(403);
  });
});
