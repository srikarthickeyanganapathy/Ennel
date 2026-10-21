import { addBusinessDays, toBusinessDate } from '@ennel/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase, seedFixtures } from './helpers/database';
import { seedRoles, staffToken } from './helpers/staff';
import { createTestApp, type TestApp } from './helpers/test-app';

const PASSWORD = 'correct-horse-1';

/** Slot lifecycle and capacity rules (Admin §D, BR-MEAL-4..6, BR-BOOK-7). */
describe('admin slots', () => {
  let ctx: TestApp;
  let managerToken: string;
  const http = () => request(ctx.app.getHttpServer());
  const as = (method: 'get' | 'post' | 'patch', path: string) =>
    http()[method](path).set('Authorization', `Bearer ${managerToken}`);

  async function lunch() {
    return ctx.prisma.meal.findUniqueOrThrow({
      where: { mealType: 'LUNCH' },
      include: { slots: { orderBy: { startMinute: 'asc' } } },
    });
  }

  async function createStudent(referenceNumber: string): Promise<string> {
    const roster = await ctx.prisma.collegeRosterEntry.findUniqueOrThrow({
      where: { referenceNumber },
    });
    const student = await ctx.prisma.student.create({
      data: {
        rosterEntryId: roster.id,
        passwordHash: 'not-a-real-hash',
        fullName: roster.fullName,
        department: roster.department,
        academicYear: roster.academicYear,
      },
    });
    return student.id;
  }

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    await seedFixtures(ctx.prisma);
    await seedRoles(ctx.prisma);
    ctx.rateLimiter.reset();
    managerToken = await staffToken(ctx, ['MESS_MANAGER']);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('never lets two slots be disabled into each other at the same time', async () => {
    const meal = await lunch();
    const [first, second] = meal.slots;
    if (!first || !second) throw new Error('slots missing');
    for (const [referenceNumber, slot] of [
      ['24900001', first],
      ['24900002', second],
    ] as const) {
      await ctx.prisma.mealPreference.create({
        data: {
          studentId: await createStudent(referenceNumber),
          mealId: meal.id,
          slotId: slot.id,
          isEnabled: true,
          dietType: 'VEG',
        },
      });
    }

    const [a, b] = await Promise.all([
      as('post', `/api/v1/admin/mess-config/slots/${first.id}/disable`).send({
        reason: 'Renovation',
        reassignToSlotId: second.id,
      }),
      as('post', `/api/v1/admin/mess-config/slots/${second.id}/disable`).send({
        reason: 'Renovation',
        reassignToSlotId: first.id,
      }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 400]);
    const stranded = await ctx.prisma.mealPreference.count({
      where: { slot: { isActive: false } },
    });
    expect(stranded).toBe(0);
  });

  it('records a staff slot change on bookings moved by a disable', async () => {
    const meal = await lunch();
    const [from, to] = meal.slots;
    if (!from || !to) throw new Error('slots missing');
    const booking = await ctx.prisma.booking.create({
      data: {
        studentId: await createStudent('24900001'),
        mealDate: new Date(`${addBusinessDays(toBusinessDate(new Date()), 1)}T00:00:00Z`),
        mealId: meal.id,
        slotId: from.id,
        dietType: 'VEG',
        source: 'DEFAULT',
        status: 'BOOKED',
        lastActorType: 'SYSTEM',
      },
    });

    await as('post', `/api/v1/admin/mess-config/slots/${from.id}/disable`)
      .send({ reason: 'Kitchen repair', reassignToSlotId: to.id })
      .expect(200);
    const moved = await ctx.prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: { events: true },
    });
    expect(moved).toMatchObject({ slotId: to.id, lastActorType: 'STAFF' });
    expect(moved.lastActorStaffId).not.toBeNull();
    expect(moved.events).toEqual([
      expect.objectContaining({
        type: 'SLOT_CHANGED',
        actorType: 'STAFF',
        reason: 'Kitchen repair',
        payload: { fromSlotId: from.id, toSlotId: to.id },
      }),
    ]);
  });

  it('lists slots to students in serving order after an earlier slot is added', async () => {
    const meal = await lunch();
    await as('patch', `/api/v1/admin/mess-config/meals/${meal.id}`)
      .send({
        displayName: meal.displayName,
        serviceStartMinute: 600,
        serviceEndMinute: meal.serviceEndMinute,
        attendanceGraceMinutes: meal.attendanceGraceMinutes,
        version: meal.version,
      })
      .expect(200);
    await as('post', '/api/v1/admin/mess-config/slots')
      .send({ mealId: meal.id, startMinute: 600, endMinute: 630, defaultCapacity: 100 })
      .expect(201);

    const session = (
      await http()
        .post('/api/v1/auth/register')
        .send({ referenceNumber: '24900003', password: PASSWORD, confirmPassword: PASSWORD })
        .expect(201)
    ).body;
    const meals = await http()
      .get('/api/v1/meals')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    const lunchSlots = meals.body.items.find(
      (item: { mealType: string }) => item.mealType === 'LUNCH',
    ).slots as { startMinute: number; sortOrder: number }[];
    const starts = lunchSlots.map((slot) => slot.startMinute);
    expect(starts).toEqual([...starts].sort((x, y) => x - y));
    expect(lunchSlots.map((slot) => slot.sortOrder)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('rejects a capacity-impact check that omits its weekday or date', async () => {
    const slot = (await lunch()).slots[0];
    if (!slot) throw new Error('slot missing');
    const path = `/api/v1/admin/mess-config/slots/${slot.id}/capacity-impact`;
    await as('get', `${path}?capacity=1&scope=WEEKDAY`).expect(400);
    await as('get', `${path}?capacity=1&scope=DATE`).expect(400);
    await as('get', `${path}?capacity=1&scope=WEEKDAY&weekday=3`).expect(200);
  });
});
