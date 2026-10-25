import { randomUUID } from 'node:crypto';
import { addBusinessDays, getBusinessWeekday, toBusinessDate } from '@ennel/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase, seedFixtures } from './helpers/database';
import { seedRoles } from './helpers/staff';
import { createTestApp, type TestApp } from './helpers/test-app';

const PASSWORD = 'correct-horse-1';

describe('Plan Ahead weekday rules (Spec §6.2, BR-PLAN, ADR-0014, ADR-0024)', () => {
  let ctx: TestApp;
  let token: string;
  let tomorrow: string;
  let lunch: string[];
  const http = () => request(ctx.app.getHttpServer());
  const auth = (value = token) => ({ Authorization: `Bearer ${value}` });
  const lunchOn = async (date: string) =>
    (await http().get(`/api/v1/days/${date}`).set(auth()).expect(200)).body.meals.find(
      (meal: { mealType: string }) => meal.mealType === 'LUNCH',
    );
  const createRule = (weekdays: number[], slotId: string, dietType = 'NON_VEG') =>
    http()
      .post('/api/v1/weekday-rules')
      .set(auth())
      .send({ weekdays, meals: [{ mealType: 'LUNCH', slotId, dietType }] });

  async function register(referenceNumber: string): Promise<string> {
    const session = await http()
      .post('/api/v1/auth/register')
      .send({ referenceNumber, password: PASSWORD, confirmPassword: PASSWORD })
      .expect(201);
    return session.body.accessToken as string;
  }

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
    lunch = (
      await ctx.prisma.mealSlot.findMany({
        where: { meal: { mealType: 'LUNCH' } },
        orderBy: { startMinute: 'asc' },
      })
    ).map((slot) => slot.id);
    token = await register('24900001');
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
        mealPreferences: [
          { mealType: 'BREAKFAST', isEnabled: false, slotId: null, dietType: 'VEG' },
          { mealType: 'LUNCH', isEnabled: true, slotId: lunch[0], dietType: 'VEG' },
          { mealType: 'DINNER', isEnabled: false, slotId: null, dietType: 'VEG' },
        ],
      })
      .expect(200);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('books the rule’s slot on its weekdays only and shows the rule as applied', async () => {
    const created = await createRule([getBusinessWeekday(tomorrow)], lunch[1]!).expect(201);
    expect(created.body.items).toHaveLength(1);
    expect(created.body.items[0]).toMatchObject({ mealType: 'LUNCH', pausedReason: null });
    expect(created.body.bookingsUpdated).toBeGreaterThanOrEqual(1);

    const card = await lunchOn(tomorrow);
    expect(card).toMatchObject({ label: 'BOOKED_WEEKDAY_RULE', appliedRule: 'WEEKDAY_RULE' });
    expect(card.booking).toMatchObject({ slotId: lunch[1], dietType: 'NON_VEG' });
    const dayAfter = await lunchOn(addBusinessDays(tomorrow, 1));
    expect(dayAfter.booking).toMatchObject({ slotId: lunch[0], dietType: 'VEG' });
  });

  it('rejects overlapping days for the same meal and slots of another meal', async () => {
    const day = getBusinessWeekday(tomorrow);
    await createRule([day, (day + 2) % 7], lunch[1]!).expect(201);
    const overlap = await createRule([day], lunch[0]!).expect(400);
    expect(overlap.body.message).toMatch(/^Lunch already has a weekday rule on /);
    const dinnerSlot = await ctx.prisma.mealSlot.findFirstOrThrow({
      where: { meal: { mealType: 'DINNER' } },
    });
    await createRule([(day + 1) % 7], dinnerSlot.id).expect(400);
    await createRule([], lunch[1]!).expect(400);
  });

  it('keeps a one-day change over the rule for that date (ADR-0014)', async () => {
    const card = await lunchOn(tomorrow);
    await http()
      .patch(`/api/v1/bookings/${card.booking.id}`)
      .set(auth())
      .set('Idempotency-Key', randomUUID())
      .send({ slotId: lunch[2], version: card.booking.version })
      .expect(200);
    await createRule([getBusinessWeekday(tomorrow)], lunch[1]!).expect(201);
    expect(await lunchOn(tomorrow)).toMatchObject({
      appliedRule: 'DATE_EXCEPTION',
      booking: { slotId: lunch[2] },
    });
  });

  it('edits with the shown version, and deleting returns the days to Default Booking', async () => {
    const created = await createRule([getBusinessWeekday(tomorrow)], lunch[1]!).expect(201);
    const rule = created.body.items[0];
    const edited = await http()
      .patch(`/api/v1/weekday-rules/${rule.id}`)
      .set(auth())
      .send({ dietType: 'VEG', version: rule.version })
      .expect(200);
    expect(edited.body.items[0]).toMatchObject({ dietType: 'VEG', version: rule.version + 1 });
    await http()
      .patch(`/api/v1/weekday-rules/${rule.id}`)
      .set(auth())
      .send({ dietType: 'NON_VEG', version: rule.version })
      .expect(409);

    await http()
      .delete(`/api/v1/weekday-rules/${rule.id}`)
      .query({ version: rule.version + 1 })
      .set(auth())
      .expect(200);
    expect(await lunchOn(tomorrow)).toMatchObject({
      label: 'BOOKED_DEFAULT',
      booking: { slotId: lunch[0], source: 'DEFAULT' },
    });
    expect((await http().get('/api/v1/weekday-rules').set(auth()).expect(200)).body.items).toEqual(
      [],
    );
  });

  it('pauses rules while Default Booking is OFF (ADR-0024)', async () => {
    await createRule([getBusinessWeekday(tomorrow)], lunch[1]!).expect(201);
    const preferences = await http().get('/api/v1/default-preferences').set(auth()).expect(200);
    await http()
      .put('/api/v1/default-preferences')
      .set(auth())
      .send({
        defaultBookingEnabled: false,
        meals: preferences.body.meals.map(
          (meal: { mealType: string; isEnabled: boolean; slotId: string; dietType: string }) => ({
            mealType: meal.mealType,
            isEnabled: meal.isEnabled,
            slotId: meal.slotId,
            dietType: meal.dietType,
          }),
        ),
      })
      .expect(200);
    const list = await http().get('/api/v1/weekday-rules').set(auth()).expect(200);
    expect(list.body.items[0].pausedReason).toBe('DEFAULT_BOOKING_OFF');
    expect((await lunchOn(tomorrow)).label).toBe('NOT_BOOKED_DEFAULT_OFF');
  });

  it('hides one student’s rules from another', async () => {
    const created = await createRule([getBusinessWeekday(tomorrow)], lunch[1]!).expect(201);
    const other = await register('24900002');
    expect(
      (await http().get('/api/v1/weekday-rules').set(auth(other)).expect(200)).body.items,
    ).toEqual([]);
    await http()
      .delete(`/api/v1/weekday-rules/${created.body.items[0].id}`)
      .query({ version: 1 })
      .set(auth(other))
      .expect(404);
  });
});
