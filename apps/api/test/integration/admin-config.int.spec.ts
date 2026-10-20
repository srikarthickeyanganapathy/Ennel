import { toBusinessDate, addBusinessDays } from '@ennel/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase, seedFixtures } from './helpers/database';
import { auditCount, seedRoles, staffToken } from './helpers/staff';
import { createTestApp, type TestApp } from './helpers/test-app';

interface SlotBody {
  id: string;
  label: string;
  isActive: boolean;
  version: number;
  startMinute: number;
}
interface MealBody {
  id: string;
  mealType: string;
  version: number;
  serviceStartMinute: number;
  serviceEndMinute: number;
  slots: SlotBody[];
}

const PASSWORD = 'correct-horse-1';

describe('mess configuration, policy and menus (Admin §D, §E)', () => {
  let ctx: TestApp;
  let adminToken: string;
  let managerToken: string;
  const http = () => request(ctx.app.getHttpServer());
  const as = (token: string, method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string) =>
    http()[method](path).set('Authorization', `Bearer ${token}`);

  async function meals(): Promise<MealBody[]> {
    return (await as(managerToken, 'get', '/api/v1/admin/mess-config/meals').expect(200)).body
      .items;
  }

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    await seedFixtures(ctx.prisma);
    await seedRoles(ctx.prisma);
    ctx.rateLimiter.reset();
    adminToken = await staffToken(ctx, ['SUPER_ADMIN']);
    managerToken = await staffToken(ctx, ['MESS_MANAGER']);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('adds, edits and validates slots, refusing overlap and Breakfast extras', async () => {
    const [breakfast, lunch] = await meals();
    if (!breakfast || !lunch) throw new Error('meals missing');
    const noExtra = await as(managerToken, 'post', '/api/v1/admin/mess-config/slots').send({
      mealId: breakfast.id,
      startMinute: 420,
      endMinute: 450,
      defaultCapacity: 100,
    });
    expect(noExtra.status).toBe(400);
    const overlap = await as(managerToken, 'post', '/api/v1/admin/mess-config/slots').send({
      mealId: lunch.id,
      startMinute: 670,
      endMinute: 700,
      defaultCapacity: 100,
    });
    expect(overlap.body.message).toMatch(/overlaps/);

    const firstSlot = lunch.slots[0];
    if (!firstSlot) throw new Error('slot missing');
    const edited = await as(
      managerToken,
      'patch',
      `/api/v1/admin/mess-config/slots/${firstSlot.id}`,
    )
      .send({ startMinute: 660, endMinute: 690, defaultCapacity: 450, version: firstSlot.version })
      .expect(200);
    expect(edited.body).toMatchObject({ defaultCapacity: 450, label: '11:00 AM - 11:30 AM' });
    expect(await auditCount(ctx.prisma, firstSlot.id, 'slot.update')).toBe(1);
  });

  it("keeps Breakfast's slot in step with its serving window", async () => {
    const [breakfast] = await meals();
    if (!breakfast) throw new Error('meal missing');
    await as(managerToken, 'patch', `/api/v1/admin/mess-config/meals/${breakfast.id}`)
      .send({
        displayName: 'Breakfast',
        serviceStartMinute: 435,
        serviceEndMinute: 525,
        attendanceGraceMinutes: 15,
        version: breakfast.version,
      })
      .expect(200);
    const [after] = await meals();
    expect(after?.slots[0]).toMatchObject({ startMinute: 435, label: '7:15 AM - 8:45 AM' });
  });

  it('requires a reassignment target to disable a slot in use, then moves preferences', async () => {
    const session = (
      await http()
        .post('/api/v1/auth/register')
        .send({ referenceNumber: '24900001', password: PASSWORD, confirmPassword: PASSWORD })
    ).body;
    const [, lunch] = await meals();
    const [from, to] = lunch?.slots ?? [];
    if (!lunch || !from || !to) throw new Error('slots missing');
    const block = await ctx.prisma.hostelBlock.findFirstOrThrow();
    await http()
      .put('/api/v1/me/onboarding')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        profile: {
          hostelBlockId: block.id,
          roomNumber: '1',
          phone: '9876543210',
          parentPhone: '9876543211',
        },
        defaultBookingEnabled: true,
        mealPreferences: [
          { mealType: 'BREAKFAST', isEnabled: false, slotId: null, dietType: 'VEG' },
          { mealType: 'LUNCH', isEnabled: true, slotId: from.id, dietType: 'VEG' },
          { mealType: 'DINNER', isEnabled: false, slotId: null, dietType: 'VEG' },
        ],
      })
      .expect(200);

    const usage = await as(
      managerToken,
      'get',
      `/api/v1/admin/mess-config/slots/${from.id}/usage`,
    ).expect(200);
    expect(usage.body.preferences).toBe(1);
    await as(managerToken, 'delete', `/api/v1/admin/mess-config/slots/${from.id}`)
      .send({ reason: 'cleanup' })
      .expect(400);
    const missingTarget = await as(
      managerToken,
      'post',
      `/api/v1/admin/mess-config/slots/${from.id}/disable`,
    ).send({ reason: 'Renovation' });
    expect(missingTarget.body.message).toMatch(/Choose a slot/);
    await as(managerToken, 'post', `/api/v1/admin/mess-config/slots/${from.id}/disable`)
      .send({ reason: 'Renovation', reassignToSlotId: to.id })
      .expect(200);
    const preference = await ctx.prisma.mealPreference.findFirstOrThrow({
      where: { meal: { mealType: 'LUNCH' } },
    });
    expect(preference.slotId).toBe(to.id);
  });

  it('manages weekday capacities, date overrides and the lowering impact check', async () => {
    const [, lunch] = await meals();
    const slot = lunch?.slots[0];
    if (!slot) throw new Error('slot missing');
    const tomorrow = addBusinessDays(toBusinessDate(new Date()), 1);
    await as(managerToken, 'put', `/api/v1/admin/mess-config/slots/${slot.id}/weekday-capacities`)
      .send({ capacities: [{ weekday: 0, capacity: 200 }] })
      .expect(200);
    await as(
      managerToken,
      'put',
      `/api/v1/admin/mess-config/slots/${slot.id}/capacity-overrides/${tomorrow}`,
    )
      .send({ capacity: 50, reason: 'Festival' })
      .expect(204);
    const overrides = await as(
      managerToken,
      'get',
      `/api/v1/admin/mess-config/slots/${slot.id}/capacity-overrides`,
    ).expect(200);
    expect(overrides.body.items).toEqual([
      expect.objectContaining({ mealDate: tomorrow, capacity: 50 }),
    ]);
    const impact = await as(
      managerToken,
      'get',
      `/api/v1/admin/mess-config/slots/${slot.id}/capacity-impact?capacity=0&scope=DATE&date=${tomorrow}`,
    ).expect(200);
    expect(impact.body).toEqual({ affectedDates: [], totalOverBy: 0 });
    await as(
      managerToken,
      'delete',
      `/api/v1/admin/mess-config/slots/${slot.id}/capacity-overrides/${tomorrow}`,
    )
      .send({ reason: 'Festival cancelled' })
      .expect(204);
  });

  it('edits policy with a reason and version, records history, and checks cross-field rules', async () => {
    const policy = (await as(adminToken, 'get', '/api/v1/admin/policy').expect(200)).body;
    expect(policy).toMatchObject({
      allowOverCapacityBooking: false,
      noShowDisableThreshold: 5,
      version: 1,
    });
    await as(managerToken, 'patch', '/api/v1/admin/policy')
      .send({ leaveRequiresApproval: true, reason: 'x', version: 1 })
      .expect(403);
    const inverted = await as(adminToken, 'patch', '/api/v1/admin/policy').send({
      noShowWarningThreshold: 6,
      reason: 'x',
      version: 1,
    });
    expect(inverted.status).toBe(400);
    const updated = await as(adminToken, 'patch', '/api/v1/admin/policy')
      .send({ leaveRequiresApproval: true, reason: 'Hostel council decision', version: 1 })
      .expect(200);
    expect(updated.body).toMatchObject({
      leaveRequiresApproval: true,
      version: 2,
      updatedByName: 'Test SUPER_ADMIN',
    });
    await as(adminToken, 'patch', '/api/v1/admin/policy')
      .send({ leaveRequiresApproval: false, reason: 'x', version: 1 })
      .expect(409);
    const history = await as(adminToken, 'get', '/api/v1/admin/policy/history').expect(200);
    expect(history.body.items[0]).toMatchObject({
      before: { leaveRequiresApproval: false },
      after: { leaveRequiresApproval: true },
      reason: 'Hostel council decision',
    });

    const thresholds = await as(managerToken, 'patch', '/api/v1/admin/mess-config/thresholds')
      .send({
        fillingFastThresholdPct: 85,
        recommendedMaxOccupancyPct: 50,
        reason: 'Tune labels',
        version: 2,
      })
      .expect(200);
    expect(thresholds.body.fillingFastThresholdPct).toBe(85);
  });

  it('drafts, publishes and republishes a menu, notifying booked students only on change', async () => {
    const session = (
      await http()
        .post('/api/v1/auth/register')
        .send({ referenceNumber: '24900001', password: PASSWORD, confirmPassword: PASSWORD })
    ).body;
    const student = await ctx.prisma.student.findFirstOrThrow();
    const date = addBusinessDays(toBusinessDate(new Date()), 1);
    const [, lunch] = await meals();
    const slot = lunch?.slots[0];
    if (!lunch || !slot || !session.accessToken) throw new Error('setup failed');
    await ctx.prisma.booking.create({
      data: {
        studentId: student.id,
        mealDate: new Date(`${date}T00:00:00Z`),
        mealId: lunch.id,
        slotId: slot.id,
        dietType: 'VEG',
        source: 'DEFAULT',
        status: 'BOOKED',
        lastActorType: 'SYSTEM',
      },
    });

    const draft = await as(managerToken, 'put', `/api/v1/admin/menus/${date}/LUNCH`)
      .send({
        items: [
          { name: 'Rice', dietType: 'VEG' },
          { name: 'Chicken curry', dietType: 'NON_VEG' },
        ],
      })
      .expect(200);
    expect(draft.body).toMatchObject({ status: 'DRAFT', hasUnpublishedChanges: true });
    const first = await as(managerToken, 'post', `/api/v1/admin/menus/${draft.body.id}/publish`)
      .send({ version: draft.body.version })
      .expect(200);
    expect(first.body).toMatchObject({ isChanged: false, notifiedStudents: 0 });

    const edited = await as(managerToken, 'put', `/api/v1/admin/menus/${date}/LUNCH`)
      .send({ items: [{ name: 'Rice', dietType: 'VEG' }], version: first.body.menu.version })
      .expect(200);
    expect(edited.body).toMatchObject({
      status: 'PUBLISHED',
      hasUnpublishedChanges: true,
      publishedItems: [{ name: 'Rice' }, { name: 'Chicken curry' }],
    });
    const second = await as(managerToken, 'post', `/api/v1/admin/menus/${edited.body.id}/publish`)
      .send({ version: edited.body.version })
      .expect(200);
    expect(second.body).toMatchObject({ isChanged: true, notifiedStudents: 1 });
    expect(
      await ctx.prisma.notification.count({ where: { studentId: student.id, category: 'MENU' } }),
    ).toBe(1);

    const week = await as(managerToken, 'get', `/api/v1/admin/menus?from=${date}&days=7`).expect(
      200,
    );
    expect(week.body.menus).toHaveLength(21);
    const copied = await as(managerToken, 'post', '/api/v1/admin/menus/copy-week')
      .send({ fromWeekStart: date, toWeekStart: addBusinessDays(date, 7) })
      .expect(200);
    expect(copied.body.copied).toBe(1);
  });

  it('manages hostels and blocks', async () => {
    const created = await as(managerToken, 'post', '/api/v1/admin/hostels')
      .send({ name: 'Hostel B' })
      .expect(201);
    const hostel = created.body.items.find((item: { name: string }) => item.name === 'Hostel B');
    await as(managerToken, 'post', `/api/v1/admin/hostels/${hostel.id}/blocks`)
      .send({ name: 'North' })
      .expect(201);
    await as(managerToken, 'post', '/api/v1/admin/hostels').send({ name: 'hostel b' }).expect(400);
    const wardenToken = await staffToken(ctx, ['WARDEN']);
    const list = await as(wardenToken, 'get', '/api/v1/admin/hostels').expect(200);
    expect(list.body.items.map((item: { name: string }) => item.name)).toEqual([
      'Hostel B',
      'Test Hostel',
    ]);
  });
});
