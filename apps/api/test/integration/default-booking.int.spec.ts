import { randomUUID } from 'node:crypto';
import { addBusinessDays, toBusinessDate, toInstant } from '@ennel/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GenerateDefaultBookingsService } from '../../src/modules/jobs/services/generate-default-bookings.service';
import { resetDatabase, seedFixtures } from './helpers/database';
import { createStaff, seedRoles } from './helpers/staff';
import { createTestApp, type TestApp } from './helpers/test-app';

const PASSWORD = 'correct-horse-1';

describe('Default Booking (Spec §8, BR-DEF, ADR-0006)', () => {
  let ctx: TestApp;
  let token: string;
  let studentId: string;
  let tomorrow: string;
  let lunch: string[];
  const http = () => request(ctx.app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const lunchBookings = (status = 'BOOKED') =>
    ctx.prisma.booking.findMany({
      where: { studentId, status: status as 'BOOKED', meal: { mealType: 'LUNCH' } },
      orderBy: { mealDate: 'asc' },
    });
  const tomorrowLunch = async () =>
    (await http().get(`/api/v1/days/${tomorrow}`).set(auth()).expect(200)).body.meals.find(
      (meal: { mealType: string }) => meal.mealType === 'LUNCH',
    );
  const meals = (lunchSlot: string | undefined, enabled = true) => [
    { mealType: 'BREAKFAST', isEnabled: false, slotId: null, dietType: 'VEG' },
    { mealType: 'LUNCH', isEnabled: enabled, slotId: lunchSlot ?? null, dietType: 'VEG' },
    { mealType: 'DINNER', isEnabled: false, slotId: null, dietType: 'VEG' },
  ];

  async function onboard(lunchSlot: string | undefined): Promise<void> {
    const session = await http()
      .post('/api/v1/auth/register')
      .send({ referenceNumber: '24900001', password: PASSWORD, confirmPassword: PASSWORD })
      .expect(201);
    token = session.body.accessToken as string;
    const block = await ctx.prisma.hostelBlock.findFirstOrThrow();
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
        mealPreferences: meals(lunchSlot),
      })
      .expect(200);
    studentId = (await ctx.prisma.student.findFirstOrThrow()).id;
  }

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    await seedFixtures(ctx.prisma);
    await seedRoles(ctx.prisma);
    ctx.rateLimiter.reset();
    // Just after midnight IST, so every meal today is still open whatever time the suite runs.
    ctx.clock.set(toInstant(toBusinessDate(new Date()), 1));
    tomorrow = addBusinessDays(toBusinessDate(ctx.clock.now()), 1);
    const slots = await ctx.prisma.mealSlot.findMany({
      where: { meal: { mealType: 'LUNCH' } },
      orderBy: { startMinute: 'asc' },
    });
    lunch = slots.map((slot) => slot.id);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('creates upcoming Default Bookings as soon as setup is saved', async () => {
    await onboard(lunch[0]);
    const booked = await lunchBookings();
    expect(booked.length).toBeGreaterThanOrEqual(7);
    expect(
      booked.every((booking) => booking.source === 'DEFAULT' && booking.lastActorType === 'SYSTEM'),
    ).toBe(true);
    expect((await tomorrowLunch()).label).toBe('BOOKED_DEFAULT');
  });

  it('switching Default Booking off cancels upcoming defaults and on brings them back (BR-DEF-3)', async () => {
    await onboard(lunch[0]);
    const off = await http()
      .put('/api/v1/default-preferences')
      .set(auth())
      .send({ defaultBookingEnabled: false, meals: meals(lunch[0]) })
      .expect(200);
    expect(off.body.changes).toEqual([
      { mealType: null, field: 'DEFAULT_BOOKING', from: 'ON', to: 'OFF' },
    ]);
    expect(off.body.bookingsUpdated).toBeGreaterThan(0);
    expect(await lunchBookings()).toHaveLength(0);
    expect((await tomorrowLunch()).label).toBe('NOT_BOOKED_DEFAULT_OFF');

    await http()
      .put('/api/v1/default-preferences')
      .set(auth())
      .send({ defaultBookingEnabled: true, meals: meals(lunch[0]) })
      .expect(200);
    expect((await tomorrowLunch()).label).toBe('BOOKED_DEFAULT');
  });

  it('moves upcoming defaults to a new slot but keeps a one-day change (Rule 5)', async () => {
    await onboard(lunch[0]);
    const day = await tomorrowLunch();
    await http()
      .patch(`/api/v1/bookings/${day.booking.id}`)
      .set(auth())
      .set('Idempotency-Key', randomUUID())
      .send({ slotId: lunch[4], version: day.booking.version })
      .expect(200);

    const changed = await http()
      .patch('/api/v1/default-preferences/LUNCH')
      .set(auth())
      .send({ slotId: lunch[2], dietType: 'NON_VEG' })
      .expect(200);
    expect(changed.body.changes.map((change: { field: string }) => change.field)).toEqual([
      'SLOT',
      'MEAL_TYPE',
    ]);
    const booked = await lunchBookings();
    const forTomorrow = booked.find((booking) =>
      booking.mealDate.toISOString().startsWith(tomorrow),
    );
    expect(forTomorrow).toMatchObject({ slotId: lunch[4], source: 'MANUAL', dietType: 'VEG' });
    expect(
      booked
        .filter((booking) => booking.source === 'DEFAULT')
        .every((booking) => booking.slotId === lunch[2] && booking.dietType === 'NON_VEG'),
    ).toBe(true);
  });

  it('asks the student to choose when the usual slot is full, or books the next slot when allowed (ADR-0006)', async () => {
    const staff = await createStaff(ctx.prisma, ['MESS_MANAGER']);
    await ctx.prisma.slotCapacityOverride.create({
      data: {
        slotId: lunch[0] ?? '',
        mealDate: new Date(`${tomorrow}T00:00:00Z`),
        capacity: 0,
        reason: 'test',
        createdById: staff.id,
      },
    });
    await onboard(lunch[0]);
    expect((await tomorrowLunch()).booking).toBeNull();
    const ask = await ctx.prisma.notification.findFirstOrThrow({
      where: { studentId, dedupeKey: { startsWith: `default-slot-full:${tomorrow}:LUNCH` } },
    });
    expect(ask.title).toBe('Choose a lunch slot');

    await ctx.prisma.messPolicy.update({
      where: { id: 1 },
      data: { defaultSlotFullFallback: 'AUTO_NEXT_AVAILABLE' },
    });
    await http()
      .patch('/api/v1/default-preferences/LUNCH')
      .set(auth())
      .send({ dietType: 'NON_VEG' })
      .expect(200);
    expect((await tomorrowLunch()).booking).toMatchObject({ slotId: lunch[1], source: 'DEFAULT' });
    expect(
      await ctx.prisma.notification.count({
        where: { studentId, dedupeKey: { startsWith: `default-slot-moved:${tomorrow}:LUNCH` } },
      }),
    ).toBe(1);
    // The saved preference is unchanged.
    const preferences = (await http().get('/api/v1/default-preferences').set(auth()).expect(200))
      .body;
    expect(preferences.meals[1]).toMatchObject({ slotId: lunch[0] });
    expect(preferences.fallbackPolicy).toBe('AUTO_NEXT_AVAILABLE');
  });

  it('runs the nightly generation once per day and fills the new last day of the horizon', async () => {
    await onboard(lunch[0]);
    const lastDay = await ctx.prisma.booking.findFirstOrThrow({
      where: { studentId },
      orderBy: { mealDate: 'desc' },
    });
    // As if the horizon had just moved forward by a day.
    await ctx.prisma.bookingEvent.deleteMany({ where: { bookingId: lastDay.id } });
    await ctx.prisma.booking.delete({ where: { id: lastDay.id } });

    const job = ctx.app.get(GenerateDefaultBookingsService);
    const first = await job.run();
    expect(first).toMatchObject({
      status: 'SUCCEEDED',
      stats: { students: 1, created: 1, failedStudents: 0 },
    });
    expect((await job.run()).status).toBe('SKIPPED');
    expect(
      await ctx.prisma.jobRun.count({
        where: { jobName: 'generate-default-bookings', status: 'SUCCEEDED' },
      }),
    ).toBe(1);
  });

  it('validates preferences before saving', async () => {
    await onboard(lunch[0]);
    const bad = await http()
      .patch('/api/v1/default-preferences/LUNCH')
      .set(auth())
      .send({ slotId: randomUUID() })
      .expect(400);
    expect(bad.body.code).toBe('VALIDATION_FAILED');
    await http()
      .patch('/api/v1/default-preferences/BRUNCH')
      .set(auth())
      .send({ isEnabled: true })
      .expect(400);
  });
});
