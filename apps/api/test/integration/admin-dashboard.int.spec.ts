import { addBusinessDays, toBusinessDate } from '@ennel/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase, seedFixtures } from './helpers/database';
import { seedRoles, staffToken } from './helpers/staff';
import { createTestApp, type TestApp } from './helpers/test-app';

const PASSWORD = 'correct-horse-1';

describe('admin dashboard (Admin §C)', () => {
  let ctx: TestApp;
  let today: string;
  const http = () => request(ctx.app.getHttpServer());
  const dashboard = (token: string, date?: string) =>
    http()
      .get('/api/v1/admin/dashboard')
      .query(date ? { date } : {})
      .set('Authorization', `Bearer ${token}`);

  /** Bookings written directly so past dates and attendance can be set up. */
  async function seedLunch(
    date: string,
    rows: {
      status: 'BOOKED' | 'COMPLETED' | 'NO_SHOW';
      diet: 'VEG' | 'NON_VEG';
      attended?: boolean;
    }[],
  ) {
    const lunch = await ctx.prisma.meal.findUniqueOrThrow({ where: { mealType: 'LUNCH' } });
    const slot = await ctx.prisma.mealSlot.findFirstOrThrow({
      where: { mealId: lunch.id },
      orderBy: { startMinute: 'asc' },
    });
    const students = await ctx.prisma.student.findMany({ orderBy: { id: 'asc' } });
    for (const [index, row] of rows.entries()) {
      const student = students[index];
      if (!student) throw new Error('not enough students');
      const mealDate = new Date(`${date}T00:00:00Z`);
      const booking = await ctx.prisma.booking.create({
        data: {
          studentId: student.id,
          mealId: lunch.id,
          mealDate,
          slotId: slot.id,
          dietType: row.diet,
          source: 'MANUAL',
          status: row.status,
          lastActorType: 'STUDENT',
        },
      });
      if (row.attended) {
        await ctx.prisma.attendanceRecord.create({
          data: {
            bookingId: booking.id,
            studentId: student.id,
            mealDate,
            mealId: lunch.id,
            source: 'MANUAL_FALLBACK',
            recordedAt: new Date(),
          },
        });
      }
    }
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
    today = toBusinessDate(ctx.clock.now());
    for (const referenceNumber of ['24900001', '24900002', '24900003']) {
      await http()
        .post('/api/v1/auth/register')
        .send({ referenceNumber, password: PASSWORD, confirmPassword: PASSWORD })
        .expect(201);
    }
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('shows booked, expected and attended plates, diet split, slots and pending work', async () => {
    const yesterday = addBusinessDays(today, -1);
    const tomorrow = addBusinessDays(today, 1);
    await seedLunch(yesterday, [
      { status: 'COMPLETED', diet: 'VEG', attended: true },
      { status: 'NO_SHOW', diet: 'VEG' },
    ]);
    await seedLunch(tomorrow, [
      { status: 'BOOKED', diet: 'VEG' },
      { status: 'BOOKED', diet: 'NON_VEG' },
      { status: 'BOOKED', diet: 'NON_VEG' },
    ]);
    const student = await ctx.prisma.student.findFirstOrThrow();
    await ctx.prisma.leave.create({
      data: {
        studentId: student.id,
        startDate: new Date(`${tomorrow}T00:00:00Z`),
        startMealType: 'LUNCH',
        endDate: new Date(`${tomorrow}T00:00:00Z`),
        endMealType: 'DINNER',
        status: 'PENDING',
      },
    });

    const manager = await staffToken(ctx, ['MESS_MANAGER']);
    const body = (await dashboard(manager, tomorrow).expect(200)).body;
    expect(body).toMatchObject({
      date: tomorrow,
      today,
      canChooseDate: true,
      pending: { leaveApprovals: 1, openComplaints: 0 },
    });
    // The sidebar badges read the same counts without the rest of the dashboard.
    const pending = await request(ctx.app.getHttpServer())
      .get('/api/v1/admin/dashboard/pending')
      .set({ Authorization: `Bearer ${manager}` })
      .expect(200);
    expect(pending.body).toEqual(body.pending);
    const lunch = body.meals.find((meal: { mealType: string }) => meal.mealType === 'LUNCH');
    // One past day at 50% show-up: 3 booked → 2 expected, flagged low-confidence (BR-FC-1).
    expect(lunch).toMatchObject({
      booked: 3,
      expected: 2,
      showUpRatePct: 50,
      isExpectedLowConfidence: true,
      veg: 1,
      nonVeg: 2,
      attended: 0,
    });
    expect(lunch.slots[0]).toMatchObject({ bookedCount: 3, status: 'AVAILABLE' });

    const past = (await dashboard(manager, yesterday).expect(200)).body;
    const pastLunch = past.meals.find((meal: { mealType: string }) => meal.mealType === 'LUNCH');
    expect(pastLunch).toMatchObject({ booked: 2, attended: 1 });
    const yesterdayTrend = past.trend.at(-1);
    expect(yesterdayTrend).toEqual({
      date: yesterday,
      booked: 2,
      completed: 1,
      noShows: 1,
      noShowRatePct: 50,
    });
    expect(past.trend).toHaveLength(7);
  });

  it("limits Mess Staff to today's dashboard and keeps Auditors out", async () => {
    const kitchen = await staffToken(ctx, ['MESS_STAFF']);
    expect((await dashboard(kitchen).expect(200)).body.canChooseDate).toBe(false);
    expect((await dashboard(kitchen, addBusinessDays(today, 1)).expect(403)).body.code).toBe(
      'PERMISSION_DENIED',
    );
    await dashboard(await staffToken(ctx, ['AUDITOR'])).expect(403);
  });
});
