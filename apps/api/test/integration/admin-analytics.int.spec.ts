import { addBusinessDays, type BookingStatus, toBusinessDate } from '@ennel/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportExportsService } from '../../src/modules/admin/admin-reports/services/report-exports.service';
import { JobsQueue } from '../../src/modules/jobs/jobs-queue.service';
import { resetDatabase, seedFixtures } from './helpers/database';
import { seedRoles, staffToken } from './helpers/staff';
import { createTestApp, type TestApp } from './helpers/test-app';

const PASSWORD = 'correct-horse-1';

/** Kitchen forecast, reports and system health (Admin §N, §O, §Q, ADR-0029). */
describe('forecast, reports and system health', () => {
  let ctx: TestApp;
  let manager: string;
  let today: string;
  let studentId: string;
  let lunch: { mealId: string; slotId: string };
  const http = () => request(ctx.app.getHttpServer());
  const get = (path: string, token = manager) =>
    http().get(`/api/v1/admin/${path}`).set('Authorization', `Bearer ${token}`);
  const post = (path: string, token = manager) =>
    http().post(`/api/v1/admin/${path}`).set('Authorization', `Bearer ${token}`);

  async function seedBooking(daysFromToday: number, status: BookingStatus, attended = false) {
    const mealDate = new Date(`${addBusinessDays(today, daysFromToday)}T00:00:00Z`);
    const booking = await ctx.prisma.booking.create({
      data: {
        studentId,
        mealDate,
        mealId: lunch.mealId,
        slotId: lunch.slotId,
        dietType: 'VEG',
        source: 'DEFAULT',
        status,
        lastActorType: 'SYSTEM',
        cancelledAt: status === 'CANCELLED' ? new Date() : null,
      },
    });
    if (attended) {
      await ctx.prisma.attendanceRecord.create({
        data: {
          studentId,
          mealDate,
          mealId: lunch.mealId,
          bookingId: booking.id,
          source: 'IMPORT',
          recordedAt: new Date(),
        },
      });
    }
    return booking;
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
    manager = await staffToken(ctx, ['MESS_MANAGER']);
    await http()
      .post('/api/v1/auth/register')
      .send({ referenceNumber: '24900001', password: PASSWORD, confirmPassword: PASSWORD })
      .expect(201);
    const block = await ctx.prisma.hostelBlock.findFirstOrThrow();
    const student = await ctx.prisma.student.findFirstOrThrow();
    studentId = student.id;
    await ctx.prisma.student.update({
      where: { id: studentId },
      data: { hostelBlockId: block.id },
    });
    const slot = await ctx.prisma.mealSlot.findFirstOrThrow({
      where: { meal: { mealType: 'LUNCH' } },
      orderBy: { startMinute: 'asc' },
    });
    lunch = { mealId: slot.mealId, slotId: slot.id };
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('forecasts expected plates from past show-up, and flags short history', async () => {
    await seedBooking(-1, 'COMPLETED', true);
    await seedBooking(-2, 'NO_SHOW');
    await seedBooking(1, 'BOOKED');
    const { body } = await get(`forecast?from=${addBusinessDays(today, 1)}&days=2`).expect(200);
    const tomorrow = body.meals.find(
      (meal: { date: string; mealType: string }) =>
        meal.date === addBusinessDays(today, 1) && meal.mealType === 'LUNCH',
    );
    // One day at 100% and one at 0% average to 50%; one plate rounds up to one.
    expect(tomorrow).toMatchObject({
      showUpRatePct: 50,
      daysUsed: 2,
      isLowConfidence: true,
      isLocked: false,
      veg: { booked: 1, expected: 1 },
      nonVeg: { booked: 0, expected: 0 },
    });
    expect(body.trend).toEqual(
      expect.arrayContaining([expect.objectContaining({ booked: 1, served: 1 })]),
    );
  });

  it('exports the kitchen sheet as PDF and XLSX, for staff allowed to', async () => {
    await seedBooking(0, 'BOOKED');
    const pdf = await get(`forecast/export?from=${today}&days=1&format=pdf`)
      .buffer()
      .parse((response, done) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    const xlsx = await get(`forecast/export?from=${today}&days=1&format=xlsx`).expect(200);
    expect(xlsx.headers['content-disposition']).toContain(`kitchen-sheet-${today}.xlsx`);
    const auditor = await staffToken(ctx, ['AUDITOR']);
    await get(`forecast?from=${today}`, auditor).expect(403);
  });

  it('reports counts, rate and waste, leaving closures and leave out', async () => {
    await seedBooking(-1, 'COMPLETED', true);
    await seedBooking(-2, 'NO_SHOW');
    await seedBooking(-3, 'CANCELLED');
    await seedBooking(-4, 'PAUSED_LEAVE');
    await seedBooking(-5, 'CANCELLED_BY_CLOSURE');
    const from = addBusinessDays(today, -6);
    const { body } = await get(`reports/summary?from=${from}&to=${today}&groupBy=week`).expect(200);
    expect(body.kpis).toMatchObject({
      total: 3,
      served: 1,
      cancelled: 1,
      noShows: 1,
      noShowRatePct: 50,
      wastePlates: 1,
    });
    const lunchRow = body.byMeal.find((meal: { mealType: string }) => meal.mealType === 'LUNCH');
    expect(lunchRow).toMatchObject({ served: 1, noShows: 1, total: 3 });
    expect(body.byHostel).toHaveLength(1);
    expect(body.byHostel[0]).toMatchObject({ served: 1, noShows: 1, noShowRatePct: 50 });
    expect(body.cancellations.total).toBe(1);
    expect(
      body.slots.find((slot: { slotId: string }) => slot.slotId === lunch.slotId),
    ).toBeTruthy();
  });

  it('filters by meal and hostel, and rejects future or oversized ranges', async () => {
    await seedBooking(-1, 'COMPLETED', true);
    const from = addBusinessDays(today, -2);
    const dinner = await get(`reports/summary?from=${from}&to=${today}&mealType=DINNER`).expect(
      200,
    );
    expect(dinner.body.kpis.served).toBe(0);
    const other = await ctx.prisma.hostel.create({ data: { name: 'Other hostel' } });
    const hostel = await get(
      `reports/summary?from=${from}&to=${today}&hostelId=${other.id}`,
    ).expect(200);
    expect(hostel.body.kpis.served).toBe(0);
    expect(
      hostel.body.slots.every((slot: { utilizationPct: null }) => slot.utilizationPct === null),
    ).toBe(true);
    await get(`reports/summary?from=${today}&to=${addBusinessDays(today, 1)}`).expect(400);
    await get(`reports/summary?from=${addBusinessDays(today, -400)}&to=${today}`).expect(400);
  });

  it('sends a long export to the background, audits it, and only its owner can download it', async () => {
    await seedBooking(-1, 'COMPLETED', true);
    const from = addBusinessDays(today, -60);
    await get(`reports/export?from=${from}&to=${today}&format=csv`).expect(400);
    const before = await ctx.prisma.auditLog.count({ where: { action: 'report.export.request' } });
    const queued = await post('reports/exports')
      .send({ from, to: today, format: 'csv' })
      .expect(201);
    expect(queued.body.status).toBe('QUEUED');
    expect(await ctx.prisma.auditLog.count({ where: { action: 'report.export.request' } })).toBe(
      before + 1,
    );
    await get(`reports/exports/${queued.body.id}/download`).expect(404);

    const exports = ctx.app.get(ReportExportsService, { strict: false });
    expect(await exports.runQueued()).toMatchObject({ finished: 1, failed: 0 });
    const list = await get('reports/exports').expect(200);
    expect(list.body.items[0]).toMatchObject({ id: queued.body.id, status: 'READY' });
    const file = await get(`reports/exports/${queued.body.id}/download`).expect(200);
    expect(file.text).toContain('ENNEL report');
    expect(await exports.runQueued()).toMatchObject({ finished: 0 });

    const other = await staffToken(ctx, ['SUPER_ADMIN']);
    await get(`reports/exports/${queued.body.id}/download`, other).expect(404);
  });

  it('shows system health without secrets, and runs a job only with permission and a reason', async () => {
    const admin = await staffToken(ctx, ['SUPER_ADMIN']);
    const { body } = await get('system/health', admin).expect(200);
    expect(body.jobs.map((job: { name: string }) => job.name)).toContain('generate-report-exports');
    expect(body.database).toBe('up');
    expect(JSON.stringify(body)).not.toMatch(/secret|password|postgresql:|redis:\/\//i);

    const queue = ctx.app.get(JobsQueue, { strict: false });
    const add = vi.spyOn(queue, 'add').mockResolvedValue();
    const path = 'system/jobs/close-attendance-window/run';
    await post(path, admin).send({}).expect(400);
    await post(path).send({ reason: 'Stuck' }).expect(403);
    await post('system/jobs/nope/run', admin).send({ reason: 'Stuck' }).expect(404);
    expect(add).not.toHaveBeenCalled();
    const before = await ctx.prisma.auditLog.count({ where: { action: 'system.job.run' } });
    await post(path, admin).send({ reason: 'Stuck' }).expect(202);
    expect(add).toHaveBeenCalledWith('close-attendance-window');
    expect(await ctx.prisma.auditLog.count({ where: { action: 'system.job.run' } })).toBe(
      before + 1,
    );

    // Nothing is recorded as having run if the queue cannot take it.
    add.mockRejectedValue(new Error('down'));
    await post(path, admin).send({ reason: 'Stuck' }).expect(503);
    expect(await ctx.prisma.auditLog.count({ where: { action: 'system.job.run' } })).toBe(
      before + 1,
    );
    add.mockRestore();
  });
});
