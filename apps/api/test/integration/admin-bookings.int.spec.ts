import { randomUUID } from 'node:crypto';
import { addBusinessDays, toBusinessDate } from '@ennel/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase, seedFixtures } from './helpers/database';
import { createStaff, seedRoles, staffToken } from './helpers/staff';
import { createTestApp, type TestApp } from './helpers/test-app';

const PASSWORD = 'correct-horse-1';

interface GridRow {
  id: string;
  studentName: string;
  slotId: string;
  status: string;
  version: number;
  isUpdatedByStaff: boolean;
  lastOverrideReason: string | null;
}

describe('admin bookings (Admin §H)', () => {
  let ctx: TestApp;
  let manager: string;
  let studentTokens: string[];
  let tomorrow: string;
  let lunchSlots: string[];
  const http = () => request(ctx.app.getHttpServer());
  const as = (token: string, method: 'get' | 'post', path: string) =>
    http()[method](path).set('Authorization', `Bearer ${token}`);

  async function register(referenceNumber: string): Promise<string> {
    const session = await http()
      .post('/api/v1/auth/register')
      .send({ referenceNumber, password: PASSWORD, confirmPassword: PASSWORD })
      .expect(201);
    return session.body.accessToken as string;
  }

  async function studentBooksLunch(token: string, slot = 0): Promise<string> {
    const response = await http()
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', randomUUID())
      .send({ date: tomorrow, mealType: 'LUNCH', slotId: lunchSlots[slot], dietType: 'VEG' })
      .expect(201);
    return response.body.booking.id as string;
  }

  const grid = async (query: Record<string, string> = {}): Promise<GridRow[]> =>
    (
      await as(manager, 'get', '/api/v1/admin/bookings')
        .query({ date: tomorrow, ...query })
        .expect(200)
    ).body.items;

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
    studentTokens = [await register('24900001'), await register('24900002')];
    const slots = await ctx.prisma.mealSlot.findMany({
      where: { meal: { mealType: 'LUNCH' } },
      orderBy: { startMinute: 'asc' },
    });
    lunchSlots = slots.map((slot) => slot.id);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('lists a date with filters and search', async () => {
    await studentBooksLunch(studentTokens[0] ?? '', 0);
    await studentBooksLunch(studentTokens[1] ?? '', 1);
    expect(await grid()).toHaveLength(2);
    expect(await grid({ slotId: lunchSlots[1] ?? '' })).toHaveLength(1);
    expect((await grid({ q: '24900002' })).map((row) => row.studentName)).toEqual([
      'Test Student 2',
    ]);
    expect(await grid({ mealType: 'DINNER' })).toHaveLength(0);
  });

  it('books on behalf of a student after the student deadline, with a reason and an override audit entry', async () => {
    ctx.clock.set(new Date(`${tomorrow}T11:10:00+05:30`)); // after the 11:00 AM slot started
    const student = await ctx.prisma.student.findFirstOrThrow({
      where: { rosterEntry: { referenceNumber: '24900001' } },
    });
    const body = {
      studentId: student.id,
      date: tomorrow,
      mealType: 'LUNCH',
      slotId: lunchSlots[0],
      dietType: 'VEG',
    };
    expect(
      (await as(manager, 'post', '/api/v1/admin/bookings').send(body).expect(400)).body.code,
    ).toBe('VALIDATION_FAILED');

    const created = await as(manager, 'post', '/api/v1/admin/bookings')
      .send({ ...body, reason: 'Phone died' })
      .expect(201);
    expect(created.body).toMatchObject({
      status: 'BOOKED',
      source: 'ADMIN',
      isUpdatedByStaff: true,
      lastOverrideReason: 'Phone died',
    });
    const audit = await ctx.prisma.auditLog.findFirstOrThrow({
      where: { entityId: created.body.id },
    });
    expect(audit).toMatchObject({
      action: 'booking.override.create',
      isOverride: true,
      reason: 'Phone died',
    });

    const day = await http()
      .get(`/api/v1/days/${tomorrow}`)
      .set('Authorization', `Bearer ${studentTokens[0]}`)
      .expect(200);
    expect(day.body.meals[1].booking.isUpdatedByStaff).toBe(true);
  });

  it('cancels and moves with version checks and records the staff member on the booking event', async () => {
    const id = await studentBooksLunch(studentTokens[0] ?? '');
    const stale = await as(manager, 'post', `/api/v1/admin/bookings/${id}/cancel`)
      .send({ reason: 'test', version: 9 })
      .expect(409);
    expect(stale.body.code).toBe('VERSION_CONFLICT');

    const moved = await as(manager, 'post', `/api/v1/admin/bookings/${id}/move`)
      .send({ slotId: lunchSlots[3], reason: 'Exam timing', version: 1 })
      .expect(200);
    expect(moved.body).toMatchObject({ slotId: lunchSlots[3], version: 2, isUpdatedByStaff: true });
    const event = await ctx.prisma.bookingEvent.findFirstOrThrow({
      where: { bookingId: id, type: 'SLOT_CHANGED' },
    });
    expect(event).toMatchObject({ actorType: 'STAFF', reason: 'Exam timing' });

    const cancelled = await as(manager, 'post', `/api/v1/admin/bookings/${id}/cancel`)
      .send({ reason: 'Went home', version: 2 })
      .expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');
    expect(await ctx.prisma.auditLog.count({ where: { entityId: id, isOverride: true } })).toBe(2);
  });

  it('corrects statuses but leaves leave, closure and no-show states to their processes', async () => {
    const id = await studentBooksLunch(studentTokens[0] ?? '');
    const correct = (status: string, version: number) =>
      as(manager, 'post', `/api/v1/admin/bookings/${id}/correct-status`).send({
        status,
        reason: 'fix',
        version,
      });
    expect((await correct('COMPLETED', 1).expect(200)).body.status).toBe('COMPLETED');
    expect((await correct('BOOKED', 2).expect(200)).body.status).toBe('BOOKED');
    expect((await correct('NO_SHOW', 3).expect(400)).body.code).toBe('VALIDATION_FAILED');

    await ctx.prisma.booking.update({ where: { id }, data: { status: 'PAUSED_LEAVE' } });
    expect((await correct('BOOKED', 3).expect(422)).body.code).toBe('BOOKING_NOT_ALLOWED');
  });

  it('previews and applies a bulk move, skipping bookings the target slot cannot take', async () => {
    const first = await studentBooksLunch(studentTokens[0] ?? '', 0);
    const second = await studentBooksLunch(studentTokens[1] ?? '', 0);
    const staff = await createStaff(ctx.prisma, ['MESS_MANAGER']);
    await ctx.prisma.slotCapacityOverride.create({
      data: {
        slotId: lunchSlots[4] ?? '',
        mealDate: new Date(`${tomorrow}T00:00:00Z`),
        capacity: 1,
        reason: 'test',
        createdById: staff.id,
      },
    });
    const ids = [first, second, randomUUID()];

    const preview = await as(manager, 'post', '/api/v1/admin/bookings/bulk/preview')
      .send({ bookingIds: ids, action: 'MOVE', slotId: lunchSlots[4] })
      .expect(200);
    expect(preview.body.affected).toHaveLength(2);
    expect(preview.body.skipped).toEqual([{ id: ids[2], reason: 'Booking not found.' }]);
    expect(await ctx.prisma.booking.count({ where: { slotId: lunchSlots[4] } })).toBe(0);

    const applied = await as(manager, 'post', '/api/v1/admin/bookings/bulk/apply')
      .send({ bookingIds: ids, action: 'MOVE', slotId: lunchSlots[4], reason: 'Kitchen delay' })
      .expect(200);
    expect(applied.body.affected).toHaveLength(1);
    expect(applied.body.skipped.map((item: { reason: string }) => item.reason)).toContain(
      'This slot is full. Please choose another slot.',
    );
    // audit_logs is append-only and never reset, so count only this test's bookings.
    const audited = { action: 'booking.bulk.move', entityId: { in: [first, second] } };
    expect(await ctx.prisma.auditLog.count({ where: audited })).toBe(1);
  });

  it('keeps the grid away from roles without bookings permissions', async () => {
    const kitchen = await staffToken(ctx, ['MESS_STAFF']);
    await as(kitchen, 'get', '/api/v1/admin/bookings').query({ date: tomorrow }).expect(403);
  });
});
