import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { APP_CONFIG, type AppConfig } from '../../src/config/app-config';
import { resetDatabase, seedFixtures } from './helpers/database';
import { auditCount, createStaff, loginStaff, seedRoles, staffToken } from './helpers/staff';
import { createTestApp, type TestApp } from './helpers/test-app';

const PASSWORD = 'correct-horse-1';

/** A tiny JPEG whose EXIF block carries a "location" that must not be stored. */
function jpegWithExif(): Buffer {
  const segment = (marker: number, payload: string) => {
    const header = Buffer.alloc(4);
    header.writeUInt16BE(0xff00 | marker, 0);
    header.writeUInt16BE(payload.length + 2, 2);
    return Buffer.concat([header, Buffer.from(payload, 'binary')]);
  };
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    segment(0xe0, 'JFIF\0\x01\x01'),
    segment(0xe1, 'Exif\0\0GPS-12.97N-77.59E'),
    Buffer.from([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9]),
  ]);
}

describe('complaints and the notification centre (Spec §12-13, Admin §L, BR-CMP, ADR-0028)', () => {
  let ctx: TestApp;
  let token: string;
  let studentId: string;
  const http = () => request(ctx.app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const setMode = (mode: 'ANONYMOUS' | 'PRIVATE_IDENTIFIED') =>
    ctx.prisma.messPolicy.upsert({
      where: { id: 1 },
      create: { id: 1, complaintPrivacyMode: mode },
      update: { complaintPrivacyMode: mode },
    });

  const submit = (fields: Record<string, string>, photos: Buffer[] = [], key = randomUUID()) => {
    let call = http().post('/api/v1/complaints').set(auth()).set('Idempotency-Key', key);
    for (const [name, value] of Object.entries(fields)) call = call.field(name, value);
    photos.forEach((photo, index) => {
      call = call.attach('photos', photo, { filename: `p${index}.jpg`, contentType: 'image/jpeg' });
    });
    return call;
  };
  const report = {
    type: 'COMPLAINT',
    category: 'FOOD_QUALITY',
    mealType: 'LUNCH',
    mealDate: '2026-10-30',
    description: 'The dal was cold and too salty today.',
  };

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    await seedFixtures(ctx.prisma);
    await seedRoles(ctx.prisma);
    ctx.rateLimiter.reset();
    ctx.pushProvider.reset();
    ctx.clock.set(new Date());
    const session = await http()
      .post('/api/v1/auth/register')
      .send({ referenceNumber: '24900001', password: PASSWORD, confirmPassword: PASSWORD })
      .expect(201);
    token = session.body.accessToken as string;
    studentId = (await ctx.prisma.student.findFirstOrThrow()).id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('stores an identified report with photos stripped of metadata', async () => {
    const response = await submit(report, [jpegWithExif()]).expect(201);
    expect(response.body.receiptToken).toBeNull();
    expect(response.body.complaint).toMatchObject({
      status: 'NEW',
      photoCount: 1,
      privacyMode: 'PRIVATE_IDENTIFIED',
    });
    expect(response.body.complaint.referenceCode).toMatch(/^CMP-[A-Z2-9]{6}$/);
    const stored = await ctx.prisma.complaint.findFirstOrThrow({ include: { photos: true } });
    expect(stored.studentId).toBe(studentId);
    expect(stored.hostelBlockId).not.toBeNull();
    const photo = stored.photos[0];
    expect(photo?.storageKey).toMatch(new RegExp(`^complaint-photos/${stored.id}/`));
    const config = ctx.app.get<AppConfig>(APP_CONFIG);
    const bytes = readFileSync(join(config.storageDir, photo?.storageKey ?? ''));
    expect(bytes.toString('binary')).not.toContain('GPS');
    expect(bytes.toString('binary')).toContain('JFIF');

    const list = await http().get('/api/v1/complaints').set(auth()).expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.privacyMode).toBe('PRIVATE_IDENTIFIED');
    expect(list.body.items[0]).not.toHaveProperty('notes');
  });

  it('replays a retried submit instead of filing it twice', async () => {
    const key = randomUUID();
    const first = await submit(report, [], key).expect(201);
    const second = await submit(report, [], key).expect(201);
    expect(second.body.complaint.id).toBe(first.body.complaint.id);
    expect(await ctx.prisma.complaint.count()).toBe(1);
  });

  it('rejects files that are not photos, too many photos, and half a meal reference', async () => {
    const notImage = await submit(report, [Buffer.from('this is not an image at all')]).expect(422);
    expect(notImage.body.code).toBe('FILE_INVALID');
    const photo = jpegWithExif();
    const tooMany = await submit(report, [photo, photo, photo, photo]).expect(422);
    expect(tooMany.body.code).toBe('FILE_INVALID');
    const { mealDate: _mealDate, ...withoutDate } = report;
    await submit(withoutDate).expect(400);
    expect(await ctx.prisma.complaint.count()).toBe(0);
  });

  it('keeps no identity in anonymous mode and finds the report by its receipt', async () => {
    await setMode('ANONYMOUS');
    const response = await submit(report).expect(201);
    const receiptToken = response.body.receiptToken as string;
    expect(receiptToken.length).toBeGreaterThan(30);
    const stored = await ctx.prisma.complaint.findFirstOrThrow();
    expect(stored).toMatchObject({
      studentId: null,
      hostelBlockId: null,
      privacyMode: 'ANONYMOUS',
    });
    expect(stored.submitterTokenHash).not.toBe(receiptToken);
    // The idempotent replay record must not tie the report to the student either.
    const replay = await ctx.prisma.idempotencyKey.findFirstOrThrow();
    expect(replay.actorKey).not.toContain(studentId);

    expect((await http().get('/api/v1/complaints').set(auth()).expect(200)).body.items).toEqual([]);
    const lookup = await http()
      .post('/api/v1/complaints/lookup')
      .set(auth())
      .send({ receiptTokens: [receiptToken] })
      .expect(200);
    expect(lookup.body.items).toHaveLength(1);
    expect(lookup.body.items[0].id).toBe(stored.id);

    const staff = await staffToken(ctx, ['MESS_MANAGER']);
    const detail = await http()
      .get(`/api/v1/admin/complaints/${stored.id}`)
      .set({ Authorization: `Bearer ${staff}` })
      .expect(200);
    expect(detail.body.submitter).toBeNull();
  });

  it('runs the staff workflow: review, note, assign, resolve, and tells the student', async () => {
    const id = (await submit(report).expect(201)).body.complaint.id as string;
    const manager = await createStaff(ctx.prisma, ['MESS_MANAGER']);
    const staff = { Authorization: `Bearer ${(await loginStaff(ctx, manager.email)).accessToken}` };

    const inbox = await http().get('/api/v1/admin/complaints?status=NEW').set(staff).expect(200);
    expect(inbox.body.items[0].submitter.referenceNumber).toBe('24900001');

    const skip = await http()
      .post(`/api/v1/admin/complaints/${id}/status`)
      .set(staff)
      .send({ status: 'RESOLVED', response: 'Done', version: 1 })
      .expect(400);
    expect(skip.body.code).toBe('VALIDATION_FAILED');

    await http()
      .post(`/api/v1/admin/complaints/${id}/status`)
      .set(staff)
      .send({ status: 'IN_REVIEW', version: 1 })
      .expect(200);
    await http()
      .post(`/api/v1/admin/complaints/${id}/notes`)
      .set(staff)
      .send({ body: 'Checked with the kitchen: the warmer was off.' })
      .expect(201);
    const assignees = await http().get('/api/v1/admin/complaints/assignees').set(staff).expect(200);
    expect(assignees.body.items.map((s: { id: string }) => s.id)).toContain(manager.id);
    await http()
      .post(`/api/v1/admin/complaints/${id}/assign`)
      .set(staff)
      .send({ staffId: manager.id, version: 2 })
      .expect(200);
    const stale = await http()
      .post(`/api/v1/admin/complaints/${id}/status`)
      .set(staff)
      .send({ status: 'RESOLVED', response: 'Fixed', version: 2 })
      .expect(409);
    expect(stale.body.code).toBe('VERSION_CONFLICT');
    const noReply = await http()
      .post(`/api/v1/admin/complaints/${id}/status`)
      .set(staff)
      .send({ status: 'RESOLVED', version: 3 })
      .expect(400);
    expect(noReply.body.code).toBe('VALIDATION_FAILED');
    await http()
      .post(`/api/v1/admin/complaints/${id}/status`)
      .set(staff)
      .send({ status: 'RESOLVED', response: 'The food warmer is fixed. Sorry!', version: 3 })
      .expect(200);

    const detail = await http().get(`/api/v1/admin/complaints/${id}`).set(staff).expect(200);
    expect(detail.body.notes).toHaveLength(1);
    expect(detail.body.history.map((h: { toStatus: string }) => h.toStatus)).toEqual([
      'NEW',
      'IN_REVIEW',
      'RESOLVED',
    ]);
    expect(detail.body.resolvedAt).not.toBeNull();
    expect(await auditCount(ctx.prisma, id, 'complaint.status.change')).toBe(2);
    expect(await auditCount(ctx.prisma, id, 'complaint.note.add')).toBe(1);
    expect(await auditCount(ctx.prisma, id, 'complaint.assign')).toBe(1);

    const mine = await http().get(`/api/v1/complaints/${id}`).set(auth()).expect(200);
    expect(mine.body).toMatchObject({
      status: 'RESOLVED',
      response: 'The food warmer is fixed. Sorry!',
    });
    expect(JSON.stringify(mine.body)).not.toContain('warmer was off');

    const centre = await http().get('/api/v1/notifications').set(auth()).expect(200);
    expect(centre.body.unreadCount).toBe(2);
    expect(centre.body.items[0]).toMatchObject({
      category: 'COMPLAINT',
      relatedEntityType: 'complaint',
      relatedEntityId: id,
    });

    const analytics = await http()
      .get('/api/v1/admin/complaints/analytics?from=2026-01-01&to=2027-12-31')
      .set(staff)
      .expect(200);
    expect(analytics.body.total).toBe(1);
    expect(analytics.body.byCategory).toEqual([{ category: 'FOOD_QUALITY', count: 1 }]);
    expect(analytics.body.averageResolutionHours).not.toBeNull();
  });

  it('hides earlier submitters once the mess switches to anonymous mode', async () => {
    const id = (await submit(report).expect(201)).body.complaint.id as string;
    await setMode('ANONYMOUS');
    const staff = await staffToken(ctx, ['MESS_MANAGER']);
    const detail = await http()
      .get(`/api/v1/admin/complaints/${id}`)
      .set({ Authorization: `Bearer ${staff}` })
      .expect(200);
    expect(detail.body.submitter).toBeNull();
  });

  it('keeps complaints away from staff without the permission', async () => {
    const staff = await staffToken(ctx, ['MESS_STAFF']);
    await http()
      .get('/api/v1/admin/complaints')
      .set({ Authorization: `Bearer ${staff}` })
      .expect(403);
  });

  it('marks notifications read one at a time or all at once, only for their owner', async () => {
    await ctx.prisma.notification.createMany({
      data: [1, 2, 3].map((n) => ({
        studentId,
        category: n === 3 ? ('MENU' as const) : ('BOOKING' as const),
        title: `Notice ${n}`,
        body: 'Body',
        dedupeKey: `test:${n}`,
      })),
    });
    const all = await http().get('/api/v1/notifications?pageSize=2').set(auth()).expect(200);
    expect(all.body).toMatchObject({ total: 3, unreadCount: 3, pageSize: 2 });
    const menu = await http().get('/api/v1/notifications?category=MENU').set(auth()).expect(200);
    expect(menu.body.items).toHaveLength(1);

    const first = all.body.items[0].id as string;
    const read = await http().post(`/api/v1/notifications/${first}/read`).set(auth()).expect(200);
    expect(read.body.unreadCount).toBe(2);
    const unread = await http()
      .get('/api/v1/notifications?unreadOnly=true')
      .set(auth())
      .expect(200);
    expect(unread.body.total).toBe(2);

    const other = await http()
      .post('/api/v1/auth/register')
      .send({ referenceNumber: '24900002', password: PASSWORD, confirmPassword: PASSWORD })
      .expect(201);
    await http()
      .post(`/api/v1/notifications/${first}/read`)
      .set({ Authorization: `Bearer ${other.body.accessToken as string}` })
      .expect(404);

    await http().post('/api/v1/notifications/read-all').set(auth()).expect(200);
    const count = await http().get('/api/v1/notifications/unread-count').set(auth()).expect(200);
    expect(count.body.unreadCount).toBe(0);
  });

  it('registers a push token and moves it when the device changes hands', async () => {
    const pushToken = 'ExponentPushToken[abcdefghijklmnop]';
    await http()
      .put('/api/v1/push-tokens')
      .set(auth())
      .send({ token: pushToken, platform: 'android' })
      .expect(204);
    await http()
      .put('/api/v1/push-tokens')
      .set(auth())
      .send({ token: pushToken, platform: 'android' })
      .expect(204);
    expect(await ctx.prisma.pushToken.count()).toBe(1);
    const other = await http()
      .post('/api/v1/auth/register')
      .send({ referenceNumber: '24900002', password: PASSWORD, confirmPassword: PASSWORD })
      .expect(201);
    await http()
      .put('/api/v1/push-tokens')
      .set({ Authorization: `Bearer ${other.body.accessToken as string}` })
      .send({ token: pushToken, platform: 'android' })
      .expect(204);
    const stored = await ctx.prisma.pushToken.findFirstOrThrow();
    expect(stored.studentId).not.toBe(studentId);
  });
});
