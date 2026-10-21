import { addBusinessDays, toBusinessDate } from '@ennel/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase, seedFixtures } from './helpers/database';
import { createStaff, seedRoles, staffToken } from './helpers/staff';
import { createTestApp, type TestApp } from './helpers/test-app';

const PASSWORD = 'correct-horse-1';

interface SlotRow {
  slotId: string;
  officialCapacity: number;
  bookedCount: number;
  occupancyPct: number;
  status: string;
  isRecommended: boolean;
  canSelect: boolean;
  unavailableReason: string | null;
}

describe('GET /api/v1/slots/availability (Spec §5, BR-CAP)', () => {
  let ctx: TestApp;
  let token: string;
  let tomorrow: string;
  const http = () => request(ctx.app.getHttpServer());
  const availability = (date: string, meal: string, bearer = token) =>
    http()
      .get('/api/v1/slots/availability')
      .query({ date, meal })
      .set('Authorization', `Bearer ${bearer}`);

  async function register(referenceNumber: string): Promise<string> {
    const session = await http()
      .post('/api/v1/auth/register')
      .send({ referenceNumber, password: PASSWORD, confirmPassword: PASSWORD })
      .expect(201);
    return session.body.accessToken as string;
  }

  /** Books `count` registered students into the slot directly; the booking API is Phase 4. */
  async function bookSeats(slotId: string, date: string, count: number): Promise<void> {
    const slot = await ctx.prisma.mealSlot.findUniqueOrThrow({ where: { id: slotId } });
    const students = await ctx.prisma.student.findMany({ take: count, orderBy: { id: 'asc' } });
    await ctx.prisma.booking.createMany({
      data: students.map((student) => ({
        studentId: student.id,
        mealDate: new Date(`${date}T00:00:00Z`),
        mealId: slot.mealId,
        slotId,
        dietType: 'VEG',
        source: 'MANUAL',
        status: 'BOOKED',
        lastActorType: 'STUDENT',
      })),
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
    token = await register('24900001');
    await register('24900002');
    tomorrow = addBusinessDays(toBusinessDate(ctx.clock.now()), 1);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('returns every active slot with live counts from the admin configuration', async () => {
    const lunch = (await availability(tomorrow, 'LUNCH').expect(200)).body;
    expect(lunch).toMatchObject({
      date: tomorrow,
      mealType: 'LUNCH',
      isClosed: false,
      allowOverCapacityBooking: false,
    });
    expect(lunch.slots).toHaveLength(5);
    const [first, second] = lunch.slots as SlotRow[];
    if (!first || !second) throw new Error('slots missing');

    // A per-date override of 2 seats, both booked: the slot is full and cannot be chosen.
    const staff = await createStaff(ctx.prisma, ['MESS_MANAGER']);
    await ctx.prisma.slotCapacityOverride.create({
      data: {
        slotId: first.slotId,
        mealDate: new Date(`${tomorrow}T00:00:00Z`),
        capacity: 2,
        reason: 'test',
        createdById: staff.id,
      },
    });
    await bookSeats(first.slotId, tomorrow, 2);

    const after = (await availability(tomorrow, 'LUNCH').expect(200)).body.slots as SlotRow[];
    expect(after[0]).toMatchObject({
      officialCapacity: 2,
      bookedCount: 2,
      occupancyPct: 100,
      status: 'FULL',
      canSelect: false,
      unavailableReason: 'FULL',
      isRecommended: false,
    });
    expect(after[1]).toMatchObject({ status: 'AVAILABLE', canSelect: true, isRecommended: true });
  });

  it('keeps a full slot open when the over-capacity policy is on (ADR-0005)', async () => {
    const [first] = (await availability(tomorrow, 'DINNER').expect(200)).body.slots as SlotRow[];
    if (!first) throw new Error('slots missing');
    await ctx.prisma.mealSlot.update({ where: { id: first.slotId }, data: { defaultCapacity: 1 } });
    await bookSeats(first.slotId, tomorrow, 2);
    await ctx.prisma.messPolicy.update({
      where: { id: 1 },
      data: { allowOverCapacityBooking: true },
    });

    const [row] = (await availability(tomorrow, 'DINNER').expect(200)).body.slots as SlotRow[];
    expect(row).toMatchObject({ status: 'OVER_CAPACITY', bookedCount: 2, canSelect: true });
  });

  it('marks every slot closed when a closure covers the meal', async () => {
    const staff = await createStaff(ctx.prisma, ['MESS_MANAGER']);
    const lunchMeal = await ctx.prisma.meal.findUniqueOrThrow({ where: { mealType: 'LUNCH' } });
    await ctx.prisma.messClosure.create({
      data: {
        mealDate: new Date(`${tomorrow}T00:00:00Z`),
        kind: 'MAINTENANCE',
        title: 'Kitchen maintenance',
        reason: 'test',
        createdById: staff.id,
        meals: { create: [{ mealId: lunchMeal.id }] },
      },
    });
    const body = (await availability(tomorrow, 'LUNCH').expect(200)).body;
    expect(body).toMatchObject({ isClosed: true, closureTitle: 'Kitchen maintenance' });
    expect((body.slots as SlotRow[]).every((slot) => slot.unavailableReason === 'CLOSED')).toBe(
      true,
    );
    // Other meals that day are unaffected.
    expect((await availability(tomorrow, 'DINNER').expect(200)).body.isClosed).toBe(false);
  });

  it('refuses dates outside the booking horizon and bad input', async () => {
    const today = toBusinessDate(ctx.clock.now());
    const tooFar = await availability(addBusinessDays(today, 8), 'LUNCH').expect(422);
    expect(tooFar.body).toMatchObject({
      code: 'BOOKING_NOT_ALLOWED',
      details: { lastBookableDate: addBusinessDays(today, 7) },
    });
    await availability(addBusinessDays(today, -1), 'LUNCH').expect(422);
    expect((await availability(tomorrow, 'BRUNCH').expect(400)).body.code).toBe(
      'VALIDATION_FAILED',
    );
  });

  it('is for signed-in students only', async () => {
    await http()
      .get('/api/v1/slots/availability')
      .query({ date: tomorrow, meal: 'LUNCH' })
      .expect(401);
    const staff = await staffToken(ctx, ['SUPER_ADMIN']);
    await availability(tomorrow, 'LUNCH', staff).expect(401);
  });
});
