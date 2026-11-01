import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SendScheduledAnnouncementsService } from '../../src/modules/jobs/services/send-scheduled-announcements.service';
import { NEUTRAL_PUSH } from '../../src/modules/notifications/services/push-dispatcher.service';
import { resetDatabase, seedFixtures } from './helpers/database';
import { auditCount, seedRoles, staffToken } from './helpers/staff';
import { createTestApp, type TestApp } from './helpers/test-app';

const PASSWORD = 'correct-horse-1';

describe('announcements (Admin §M, ADR-0028)', () => {
  let ctx: TestApp;
  let staff: { Authorization: string };
  const students: { id: string; token: string }[] = [];
  const http = () => request(ctx.app.getHttpServer());
  const audienceAll = {
    type: 'ALL',
    hostelIds: [],
    blockIds: [],
    academicYears: [],
    referenceNumbers: [],
  };
  const draft = (overrides: Record<string, unknown> = {}) =>
    http()
      .post('/api/v1/admin/announcements')
      .set(staff)
      .send({
        title: 'Dinner timing change',
        body: 'Dinner starts at 7:30 PM today because of the cultural event.',
        category: 'TIMING',
        audience: audienceAll,
        channels: ['IN_APP', 'PUSH'],
        ...overrides,
      })
      .expect(201);

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
    students.length = 0;
    for (const referenceNumber of ['24900001', '24900002']) {
      const session = await http()
        .post('/api/v1/auth/register')
        .send({ referenceNumber, password: PASSWORD, confirmPassword: PASSWORD })
        .expect(201);
      const student = await ctx.prisma.student.findFirstOrThrow({
        where: { rosterEntry: { referenceNumber } },
      });
      students.push({ id: student.id, token: session.body.accessToken as string });
    }
    staff = { Authorization: `Bearer ${await staffToken(ctx, ['MESS_MANAGER'])}` };
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('sends now: in-app notices for everyone, neutral pushes, delivery counts, audit', async () => {
    const first = students[0];
    if (!first) throw new Error('fixture');
    await http()
      .put('/api/v1/push-tokens')
      .set({ Authorization: `Bearer ${first.token}` })
      .send({ token: 'ExponentPushToken[first-device-01]', platform: 'android' })
      .expect(204);
    const created = (await draft()).body;
    expect(created).toMatchObject({ status: 'DRAFT', version: 1 });

    const sent = await http()
      .post(`/api/v1/admin/announcements/${created.id}/send`)
      .set(staff)
      .send({ version: 1 })
      .expect(200);
    expect(sent.body.status).toBe('SENT');
    expect(sent.body.deliveries).toEqual({ inApp: 2, pushSent: 1, pushFailed: 1 });
    expect(ctx.pushProvider.sent).toHaveLength(1);
    expect(ctx.pushProvider.sent[0]).toMatchObject({ ...NEUTRAL_PUSH });
    expect(ctx.pushProvider.sent[0]?.body).not.toContain('Dinner');

    const centre = await http()
      .get('/api/v1/notifications')
      .set({ Authorization: `Bearer ${first.token}` })
      .expect(200);
    expect(centre.body.items[0]).toMatchObject({
      category: 'ANNOUNCEMENT',
      title: 'Dinner timing change',
      relatedEntityId: created.id,
    });
    expect(await auditCount(ctx.prisma, created.id, 'announcement.send')).toBe(1);

    await http()
      .post(`/api/v1/admin/announcements/${created.id}/send`)
      .set(staff)
      .send({ version: sent.body.version })
      .expect(400);
    expect(await ctx.prisma.notification.count()).toBe(2);
  });

  it('targets a custom list and reports unknown reference numbers', async () => {
    const audience = {
      ...audienceAll,
      type: 'CUSTOM',
      referenceNumbers: ['24 900 002', '11112222'],
    };
    const preview = await http()
      .post('/api/v1/admin/announcements/audience-preview')
      .set(staff)
      .send(audience)
      .expect(200);
    expect(preview.body).toEqual({ recipients: 1, unknownReferenceNumbers: ['11112222'] });
    const empty = await http()
      .post('/api/v1/admin/announcements/audience-preview')
      .set(staff)
      .send({ ...audienceAll, type: 'HOSTEL' })
      .expect(400);
    expect(empty.body.message).toBe('Choose at least one hostel.');

    const created = (await draft({ audience, channels: ['IN_APP'] })).body;
    await http()
      .post(`/api/v1/admin/announcements/${created.id}/send`)
      .set(staff)
      .send({ version: 1 })
      .expect(200);
    const notices = await ctx.prisma.notification.findMany();
    expect(notices.map((n) => n.studentId)).toEqual([students[1]?.id]);
  });

  it('edits, schedules and sends through the worker job, once', async () => {
    const created = (await draft({ channels: ['IN_APP'] })).body;
    const edited = await http()
      .put(`/api/v1/admin/announcements/${created.id}`)
      .set(staff)
      .send({
        title: 'Dinner at 7:30 PM',
        body: 'Dinner starts later today.',
        category: 'TIMING',
        audience: audienceAll,
        channels: ['IN_APP'],
        version: 1,
      })
      .expect(200);
    const tooSoon = new Date(ctx.clock.now().getTime() + 10_000).toISOString();
    await http()
      .post(`/api/v1/admin/announcements/${created.id}/schedule`)
      .set(staff)
      .send({ scheduledFor: tooSoon, version: edited.body.version })
      .expect(400);
    const later = new Date(ctx.clock.now().getTime() + 30 * 60_000);
    const scheduled = await http()
      .post(`/api/v1/admin/announcements/${created.id}/schedule`)
      .set(staff)
      .send({ scheduledFor: later.toISOString(), version: edited.body.version })
      .expect(200);
    expect(scheduled.body.status).toBe('SCHEDULED');

    const job = ctx.app.get(SendScheduledAnnouncementsService);
    expect((await job.run()).sent).toEqual([]);
    ctx.clock.set(new Date(later.getTime() + 1000));
    expect((await job.run()).sent).toEqual([created.id]);
    expect((await job.run()).sent).toEqual([]);
    const notices = await ctx.prisma.notification.findMany();
    expect(notices).toHaveLength(2);
    expect(notices[0]?.title).toBe('Dinner at 7:30 PM');
    expect(await auditCount(ctx.prisma, created.id, 'announcement.schedule')).toBe(1);
  });

  it('cancels a scheduled announcement so the job never sends it', async () => {
    const created = (await draft()).body;
    const later = new Date(ctx.clock.now().getTime() + 5 * 60_000);
    const scheduled = await http()
      .post(`/api/v1/admin/announcements/${created.id}/schedule`)
      .set(staff)
      .send({ scheduledFor: later.toISOString(), version: 1 })
      .expect(200);
    const cancelled = await http()
      .post(`/api/v1/admin/announcements/${created.id}/cancel`)
      .set(staff)
      .send({ version: scheduled.body.version })
      .expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');
    ctx.clock.set(new Date(later.getTime() + 1000));
    await ctx.app.get(SendScheduledAnnouncementsService).run();
    expect(await ctx.prisma.notification.count()).toBe(0);
    const history = await http().get('/api/v1/admin/announcements').set(staff).expect(200);
    expect(history.body.items[0].status).toBe('CANCELLED');
  });

  it('forgets a push token the push service reports as gone', async () => {
    const first = students[0];
    if (!first) throw new Error('fixture');
    const gone = 'ExponentPushToken[old-device-0001]';
    await http()
      .put('/api/v1/push-tokens')
      .set({ Authorization: `Bearer ${first.token}` })
      .send({ token: gone, platform: 'ios' })
      .expect(204);
    ctx.pushProvider.gone.add(gone);
    const created = (await draft()).body;
    await http()
      .post(`/api/v1/admin/announcements/${created.id}/send`)
      .set(staff)
      .send({ version: 1 })
      .expect(200);
    expect(await ctx.prisma.pushToken.count()).toBe(0);
  });

  it('keeps wardens out of announcements (rbac-matrix)', async () => {
    const created = (await draft()).body;
    const warden = { Authorization: `Bearer ${await staffToken(ctx, ['WARDEN'])}` };
    await http().get('/api/v1/admin/announcements').set(warden).expect(403);
    await http()
      .post(`/api/v1/admin/announcements/${created.id}/send`)
      .set(warden)
      .send({ version: 1 })
      .expect(403);
  });
});
