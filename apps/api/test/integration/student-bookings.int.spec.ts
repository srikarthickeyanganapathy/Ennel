import { randomUUID } from 'node:crypto';
import { addBusinessDays, toBusinessDate } from '@ennel/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase, seedFixtures } from './helpers/database';
import { createStaff, seedRoles } from './helpers/staff';
import { createTestApp, type TestApp } from './helpers/test-app';

const PASSWORD = 'correct-horse-1';

interface Card {
  mealType: string;
  label: string;
  appliedRule: string;
  booking: { id: string; slotId: string; status: string; version: number; dietType: string } | null;
  actions: Record<string, { allowed: boolean; reason: string | null }>;
}

describe('student booking engine (Spec §4–5, ADR-0003/0004/0016)', () => {
  let ctx: TestApp;
  let token: string;
  let tomorrow: string;
  let lunchSlots: string[];
  let breakfastSlot: string;
  const http = () => request(ctx.app.getHttpServer());
  const auth = (bearer = token) => ({ Authorization: `Bearer ${bearer}` });

  async function register(referenceNumber: string): Promise<string> {
    const session = await http()
      .post('/api/v1/auth/register')
      .send({ referenceNumber, password: PASSWORD, confirmPassword: PASSWORD })
      .expect(201);
    return session.body.accessToken as string;
  }

  const book = (body: Record<string, string>, bearer = token, key = randomUUID()) =>
    http().post('/api/v1/bookings').set(auth(bearer)).set('Idempotency-Key', key).send(body);
  const bookLunch = (slot = 0, bearer = token) =>
    book(
      { date: tomorrow, mealType: 'LUNCH', slotId: lunchSlots[slot] ?? '', dietType: 'VEG' },
      bearer,
    );
  const day = async (date = tomorrow): Promise<Card[]> =>
    (await http().get(`/api/v1/days/${date}`).set(auth()).expect(200)).body.meals as Card[];
  const lunchCard = async () => (await day()).find((card) => card.mealType === 'LUNCH') as Card;
  /** IST wall-clock time on tomorrow's date. */
  const setClock = (time: string) => ctx.clock.set(new Date(`${tomorrow}T${time}:00+05:30`));

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    await seedFixtures(ctx.prisma);
    await seedRoles(ctx.prisma);
    ctx.rateLimiter.reset();
    ctx.clock.set(new Date());
    token = await register('24900001');
    tomorrow = addBusinessDays(toBusinessDate(ctx.clock.now()), 1);
    const slots = await ctx.prisma.mealSlot.findMany({
      include: { meal: true },
      orderBy: { startMinute: 'asc' },
    });
    lunchSlots = slots.filter((slot) => slot.meal.mealType === 'LUNCH').map((slot) => slot.id);
    breakfastSlot = slots.find((slot) => slot.meal.mealType === 'BREAKFAST')?.id ?? '';
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('shows three meal cards, not booked while Default Booking is off', async () => {
    const cards = await day();
    expect(cards.map((card) => card.mealType)).toEqual(['BREAKFAST', 'LUNCH', 'DINNER']);
    expect(
      cards.every((card) => card.label === 'NOT_BOOKED_DEFAULT_OFF' && card.actions.book?.allowed),
    ).toBe(true);
  });

  it('books once, counts the seat, and replays a retried request instead of booking twice', async () => {
    const key = randomUUID();
    const body = {
      date: tomorrow,
      mealType: 'LUNCH',
      slotId: lunchSlots[0] ?? '',
      dietType: 'VEG',
    };
    const first = await book(body, token, key).expect(201);
    expect(first.body).toMatchObject({
      label: 'BOOKED_ONCE',
      appliedRule: 'DATE_EXCEPTION',
      booking: { status: 'BOOKED' },
    });
    expect((await book(body, token, key).expect(201)).body.booking.id).toBe(first.body.booking.id);
    expect(await ctx.prisma.booking.count()).toBe(1);

    const reused = await book({ ...body, dietType: 'NON_VEG' }, token, key).expect(409);
    expect(reused.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    const noKey = await http().post('/api/v1/bookings').set(auth()).send(body).expect(400);
    expect(noKey.body.code).toBe('VALIDATION_FAILED');

    const availability = await http()
      .get('/api/v1/slots/availability')
      .query({ date: tomorrow, meal: 'LUNCH' })
      .set(auth())
      .expect(200);
    expect(availability.body.slots[0].bookedCount).toBe(1);
  });

  it('changes slot and meal type with a version check, then cancels and rebooks', async () => {
    const booked = (await bookLunch(0).expect(201)).body as Card;
    const patch = (body: Record<string, unknown>) =>
      http()
        .patch(`/api/v1/bookings/${booked.booking?.id}`)
        .set(auth())
        .set('Idempotency-Key', randomUUID())
        .send(body);

    const changed = (
      await patch({
        slotId: lunchSlots[2],
        dietType: 'NON_VEG',
        version: booked.booking?.version,
      }).expect(200)
    ).body as Card;
    expect(changed.booking).toMatchObject({
      slotId: lunchSlots[2],
      dietType: 'NON_VEG',
      version: 2,
    });
    expect((await patch({ slotId: lunchSlots[1], version: 1 }).expect(409)).body.code).toBe(
      'VERSION_CONFLICT',
    );
    const events = await ctx.prisma.bookingEvent.findMany({
      where: { bookingId: booked.booking?.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(events.map((event) => event.type)).toEqual(['CREATED', 'SLOT_CHANGED', 'DIET_CHANGED']);

    const cancel = () =>
      http()
        .post(`/api/v1/bookings/${booked.booking?.id}/cancel`)
        .set(auth())
        .set('Idempotency-Key', randomUUID());
    expect((await cancel().expect(200)).body).toMatchObject({
      label: 'CANCELLED',
      actions: { book: { allowed: true } },
    });
    const exception = await ctx.prisma.dateException.findFirstOrThrow();
    expect(exception.action).toBe('SKIP');
    expect((await bookLunch(1).expect(201)).body.booking.id).toBe(booked.booking?.id);
  });

  it('enforces deadlines: cancel closes an hour before the slot, change at its start (BR-DEAD)', async () => {
    const booked = (await bookLunch(0).expect(201)).body as Card; // 11:00 AM slot
    setClock('10:30');
    const cancel = await http()
      .post(`/api/v1/bookings/${booked.booking?.id}/cancel`)
      .set(auth())
      .set('Idempotency-Key', randomUUID())
      .expect(422);
    expect(cancel.body).toMatchObject({
      code: 'BOOKING_DEADLINE_PASSED',
      message: 'Cancellation closed at 10:00 AM.',
    });
    const card = await lunchCard();
    expect(card.actions.cancel).toMatchObject({
      allowed: false,
      reason: 'Cancellation closed at 10:00 AM.',
    });
    expect(card.actions.changeSlot?.allowed).toBe(true);

    setClock('11:00');
    const change = await http()
      .patch(`/api/v1/bookings/${booked.booking?.id}`)
      .set(auth())
      .set('Idempotency-Key', randomUUID())
      .send({ slotId: lunchSlots[3], version: 1 })
      .expect(422);
    expect(change.body.message).toBe('Slot changes closed at 11:00 AM.');
    expect((await bookLunch(0, await register('24900002')).expect(422)).body.code).toBe(
      'SLOT_UNAVAILABLE',
    );
  });

  it('cancels only the meals still before their deadline (Spec §4.4)', async () => {
    await book({
      date: tomorrow,
      mealType: 'BREAKFAST',
      slotId: breakfastSlot,
      dietType: 'VEG',
    }).expect(201);
    await bookLunch(0).expect(201);
    setClock('06:30'); // Breakfast (7:00 AM) closed at 6:00 AM; lunch closes at 10:00 AM.
    const response = await http()
      .post(`/api/v1/days/${tomorrow}/cancel-eligible`)
      .set(auth())
      .set('Idempotency-Key', randomUUID())
      .expect(200);
    expect(response.body.cancelled).toEqual(['LUNCH']);
    expect(response.body.notEligible).toEqual([
      { mealType: 'BREAKFAST', reason: 'Cancellation closed at 6:00 AM.' },
    ]);
  });

  it('gives the last seat to exactly one of several parallel bookings (ADR-0004)', async () => {
    const staff = await createStaff(ctx.prisma, ['MESS_MANAGER']);
    await ctx.prisma.slotCapacityOverride.create({
      data: {
        slotId: lunchSlots[0] ?? '',
        mealDate: new Date(`${tomorrow}T00:00:00Z`),
        capacity: 1,
        reason: 'test',
        createdById: staff.id,
      },
    });
    const tokens = [token, await register('24900002'), await register('24900003')];
    const results = await Promise.all(tokens.map((bearer) => bookLunch(0, bearer)));
    expect(results.map((response) => response.status).sort()).toEqual([201, 422, 422]);
    expect(await ctx.prisma.booking.count({ where: { status: 'BOOKED' } })).toBe(1);
  });

  it('refuses closed meals, meals on leave and other students’ bookings', async () => {
    const staff = await createStaff(ctx.prisma, ['MESS_MANAGER']);
    const lunch = await ctx.prisma.meal.findUniqueOrThrow({ where: { mealType: 'LUNCH' } });
    await ctx.prisma.messClosure.create({
      data: {
        mealDate: new Date(`${tomorrow}T00:00:00Z`),
        kind: 'FESTIVAL',
        title: 'Diwali',
        reason: 'test',
        createdById: staff.id,
        meals: { create: [{ mealId: lunch.id }] },
      },
    });
    expect((await bookLunch(0).expect(422)).body).toMatchObject({ code: 'BOOKING_NOT_ALLOWED' });
    expect((await lunchCard()).label).toBe('MESS_CLOSED');

    const student = await ctx.prisma.student.findFirstOrThrow();
    await ctx.prisma.leave.create({
      data: {
        studentId: student.id,
        startDate: new Date(`${tomorrow}T00:00:00Z`),
        startMealType: 'BREAKFAST',
        endDate: new Date(`${tomorrow}T00:00:00Z`),
        endMealType: 'DINNER',
        status: 'APPROVED',
      },
    });
    const breakfast = await book({
      date: tomorrow,
      mealType: 'BREAKFAST',
      slotId: breakfastSlot,
      dietType: 'VEG',
    }).expect(422);
    expect(breakfast.body.message).toBe('You are on leave for this meal.');

    const other = await register('24900002');
    const theirs = (
      await book(
        {
          date: tomorrow,
          mealType: 'DINNER',
          slotId: (
            await ctx.prisma.mealSlot.findFirstOrThrow({ where: { meal: { mealType: 'DINNER' } } })
          ).id,
          dietType: 'VEG',
        },
        other,
      ).expect(201)
    ).body as Card;
    await http()
      .post(`/api/v1/bookings/${theirs.booking?.id}/cancel`)
      .set(auth())
      .set('Idempotency-Key', randomUUID())
      .expect(404);
  });

  it('labels a one-day change to Default Booking as Changed for This Day (BR-BOOK-3)', async () => {
    const student = await ctx.prisma.student.update({
      where: { id: (await ctx.prisma.student.findFirstOrThrow()).id },
      data: { defaultBookingEnabled: true },
    });
    const lunch = await ctx.prisma.meal.findUniqueOrThrow({ where: { mealType: 'LUNCH' } });
    await ctx.prisma.mealPreference.create({
      data: {
        studentId: student.id,
        mealId: lunch.id,
        isEnabled: true,
        slotId: lunchSlots[0],
        dietType: 'VEG',
      },
    });
    const booking = await ctx.prisma.booking.create({
      data: {
        studentId: student.id,
        mealId: lunch.id,
        mealDate: new Date(`${tomorrow}T00:00:00Z`),
        slotId: lunchSlots[0] ?? '',
        dietType: 'VEG',
        source: 'DEFAULT',
        status: 'BOOKED',
        lastActorType: 'SYSTEM',
      },
    });
    expect((await lunchCard()).label).toBe('BOOKED_DEFAULT');
    const changed = await http()
      .patch(`/api/v1/bookings/${booking.id}`)
      .set(auth())
      .set('Idempotency-Key', randomUUID())
      .send({ slotId: lunchSlots[1], version: 1 })
      .expect(200);
    expect(changed.body).toMatchObject({
      label: 'CHANGED_FOR_THIS_DAY',
      appliedRule: 'DATE_EXCEPTION',
    });
    const breakfast = (await day()).find((card) => card.mealType === 'BREAKFAST');
    expect(breakfast?.label).toBe('NOT_BOOKED_DEFAULT_OFF');
  });

  it('refuses dates outside the booking period', async () => {
    const today = toBusinessDate(ctx.clock.now());
    const far = await http()
      .get(`/api/v1/days/${addBusinessDays(today, 8)}`)
      .set(auth())
      .expect(422);
    expect(far.body.code).toBe('BOOKING_NOT_ALLOWED');
  });
});
