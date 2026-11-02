import { addBusinessDays, toBusinessDate } from '@ennel/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase, seedFixtures } from './helpers/database';
import { seedRoles, staffToken } from './helpers/staff';
import { createTestApp, type TestApp } from './helpers/test-app';

const PASSWORD = 'correct-horse-1';
const RICE = [{ name: 'Rice', dietType: 'VEG' }];
const CURRY = [{ name: 'Chicken curry', dietType: 'NON_VEG' }];

/** Menu publishing and the weekly editor (Admin §E, BR-MENU-1..3). */
describe('admin menus', () => {
  let ctx: TestApp;
  let managerToken: string;
  const http = () => request(ctx.app.getHttpServer());
  const as = (method: 'get' | 'post' | 'put', path: string) =>
    http()[method](path).set('Authorization', `Bearer ${managerToken}`);
  const date = () => addBusinessDays(toBusinessDate(new Date()), 1);

  async function save(items: object[], version?: number) {
    return (
      await as('put', `/api/v1/admin/menus/${date()}/LUNCH`).send({ items, version }).expect(200)
    ).body as { id: string; version: number };
  }

  async function publish(menu: { id: string; version: number }) {
    return (
      await as('post', `/api/v1/admin/menus/${menu.id}/publish`)
        .send({ version: menu.version })
        .expect(200)
    ).body as { menu: { id: string; version: number }; notifiedStudents: number };
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

  it('lists each dish once for the dish library, without dishes removed from a draft', async () => {
    const menu = await save([...RICE, ...CURRY]);
    const next = await as('put', `/api/v1/admin/menus/${addBusinessDays(date(), 1)}/LUNCH`)
      .send({ items: RICE })
      .expect(200);
    expect(next.body.items).toEqual(RICE);
    const before = await as('get', '/api/v1/admin/menus/dishes').expect(200);
    expect(before.body.items).toEqual([...CURRY, ...RICE]);

    await save(RICE, menu.version);
    const after = await as('get', '/api/v1/admin/menus/dishes').expect(200);
    expect(after.body.items).toEqual(RICE);
  });

  it('notifies booked students for every changed published version, even a repeat', async () => {
    await http()
      .post('/api/v1/auth/register')
      .send({ referenceNumber: '24900001', password: PASSWORD, confirmPassword: PASSWORD })
      .expect(201);
    const student = await ctx.prisma.student.findFirstOrThrow();
    const lunch = await ctx.prisma.meal.findUniqueOrThrow({
      where: { mealType: 'LUNCH' },
      include: { slots: true },
    });
    await ctx.prisma.booking.create({
      data: {
        studentId: student.id,
        mealDate: new Date(`${date()}T00:00:00Z`),
        mealId: lunch.id,
        slotId: lunch.slots[0]?.id ?? '',
        dietType: 'VEG',
        source: 'DEFAULT',
        status: 'BOOKED',
        lastActorType: 'SYSTEM',
      },
    });

    let published = await publish(await save(RICE));
    for (const items of [CURRY, RICE, CURRY]) {
      published = await publish(await save(items, published.menu.version));
      expect(published.notifiedStudents).toBe(1);
    }
    expect(await ctx.prisma.notification.count({ where: { category: 'MENU' } })).toBe(3);
  });

  it('keeps a special-meal day when the weekly editor saves its items', async () => {
    const special = (
      await as('put', `/api/v1/admin/menus/${date()}/LUNCH`)
        .send({ items: RICE, isSpecial: true, specialTitle: 'Diwali lunch' })
        .expect(200)
    ).body;
    const bulk = await as('post', '/api/v1/admin/menus/bulk')
      .send({
        entries: [{ mealDate: date(), mealType: 'LUNCH', items: CURRY, version: special.version }],
      })
      .expect(200);
    expect(bulk.body.items[0]).toMatchObject({ isSpecial: true, specialTitle: 'Diwali lunch' });
  });
});
