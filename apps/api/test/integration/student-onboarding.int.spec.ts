import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Fixtures, resetDatabase, seedFixtures } from './helpers/database';
import { createTestApp, type TestApp } from './helpers/test-app';

const PASSWORD = 'correct-horse-1';
const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64),
]);

interface MealsBody {
  items: { id: string; mealType: string; slots: { id: string }[] }[];
}

describe('student profile and onboarding (Spec §3 Screens 5-8)', () => {
  let ctx: TestApp;
  let fixtures: Fixtures;
  let token: string;
  const http = () => request(ctx.app.getHttpServer());
  const authed = (method: 'get' | 'put' | 'patch', path: string) =>
    http()[method](path).set('Authorization', `Bearer ${token}`);

  async function slotIds(): Promise<Record<string, string[]>> {
    const body = (await authed('get', '/api/v1/meals').expect(200)).body as MealsBody;
    return Object.fromEntries(
      body.items.map((meal) => [meal.mealType, meal.slots.map((slot) => slot.id)]),
    );
  }

  async function onboardingBody() {
    const slots = await slotIds();
    return {
      profile: {
        fullName: 'Someone Else',
        hostelBlockId: fixtures.blockId,
        roomNumber: '323',
        phone: '98765 43210',
        parentPhone: '9876543211',
      },
      defaultBookingEnabled: true,
      mealPreferences: [
        { mealType: 'BREAKFAST', isEnabled: false, slotId: null, dietType: 'VEG' },
        { mealType: 'LUNCH', isEnabled: true, slotId: slots.LUNCH?.[2], dietType: 'VEG' },
        { mealType: 'DINNER', isEnabled: true, slotId: slots.DINNER?.[3], dietType: 'NON_VEG' },
      ],
    };
  }

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    fixtures = await seedFixtures(ctx.prisma);
    ctx.rateLimiter.reset();
    const session = await http()
      .post('/api/v1/auth/register')
      .send({ referenceNumber: '24900001', password: PASSWORD, confirmPassword: PASSWORD })
      .expect(201);
    token = session.body.accessToken;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('returns the profile prefilled from the roster with editable fields', async () => {
    const response = await authed('get', '/api/v1/me').expect(200);
    expect(response.body).toMatchObject({
      referenceNumber: '24900001',
      fullName: 'Test Student 1',
      hostelName: 'Test Hostel',
      blockName: 'Block A',
      isOnboardingComplete: false,
      editableFields: ['hostelBlockId', 'roomNumber', 'phone', 'parentPhone', 'email'],
    });
  });

  it('lists hostels and the configured meals and slots (Rule 1)', async () => {
    const hostels = await authed('get', '/api/v1/hostels').expect(200);
    expect(hostels.body.items).toEqual([
      {
        id: expect.any(String),
        name: 'Test Hostel',
        blocks: [{ id: fixtures.blockId, name: 'Block A' }],
      },
    ]);
    const slots = await slotIds();
    expect(Object.keys(slots)).toEqual(['BREAKFAST', 'LUNCH', 'DINNER']);
    expect(slots.BREAKFAST).toHaveLength(1);
    expect(slots.LUNCH).toHaveLength(5);
    expect(slots.DINNER).toHaveLength(7);
  });

  it('saves profile and preferences together and completes onboarding', async () => {
    const response = await authed('put', '/api/v1/me/onboarding')
      .send(await onboardingBody())
      .expect(200);
    expect(response.body).toMatchObject({
      isOnboardingComplete: true,
      defaultBookingEnabled: true,
      roomNumber: '323',
      phone: '9876543210',
      fullName: 'Test Student 1',
    });
    const preferences = await ctx.prisma.mealPreference.findMany({ include: { meal: true } });
    expect(preferences).toHaveLength(3);
    const breakfast = preferences.find((preference) => preference.meal.mealType === 'BREAKFAST');
    // The single Breakfast window is stored even while off, so switching it on needs no slot choice.
    const [breakfastSlot] = (await slotIds()).BREAKFAST ?? [];
    expect(breakfast).toMatchObject({ isEnabled: false, slotId: breakfastSlot });

    const login = await http()
      .post('/api/v1/auth/login')
      .send({ referenceNumber: '24900001', password: PASSWORD });
    expect(login.body.isOnboardingComplete).toBe(true);
  });

  it('rolls back everything when a preference is invalid', async () => {
    const body = await onboardingBody();
    body.mealPreferences[1] = { mealType: 'LUNCH', isEnabled: true, slotId: null, dietType: 'VEG' };
    const response = await authed('put', '/api/v1/me/onboarding').send(body);
    expect(response.status).toBe(400);
    expect(response.body.details.issues).toContainEqual({
      path: 'mealPreferences.LUNCH',
      message: 'Choose a slot for this meal',
    });
    expect(await ctx.prisma.mealPreference.count()).toBe(0);
    const student = await ctx.prisma.student.findFirstOrThrow();
    expect(student.onboardingCompletedAt).toBeNull();
  });

  it('rejects an unknown hostel block', async () => {
    const body = await onboardingBody();
    body.profile.hostelBlockId = '00000000-0000-4000-8000-000000000000';
    const response = await authed('put', '/api/v1/me/onboarding').send(body);
    expect(response.status).toBe(400);
  });

  describe('PATCH /me/profile', () => {
    it('rejects college-controlled fields (ADR-0018)', async () => {
      const response = await authed('patch', '/api/v1/me/profile').send({
        version: 1,
        fullName: 'New Name',
      });
      expect(response.status).toBe(400);
      expect(response.body.details.issues).toEqual([
        { path: 'fullName', message: 'Managed by the college' },
      ]);
    });

    it('updates editable fields and detects stale versions', async () => {
      const current = (await authed('get', '/api/v1/me').expect(200)).body;
      const updated = await authed('patch', '/api/v1/me/profile')
        .send({ version: current.version, roomNumber: '404' })
        .expect(200);
      expect(updated.body.roomNumber).toBe('404');
      const stale = await authed('patch', '/api/v1/me/profile').send({
        version: current.version,
        roomNumber: '405',
      });
      expect(stale.status).toBe(409);
      expect(stale.body.code).toBe('VERSION_CONFLICT');
    });
  });

  describe('PUT /me/photo', () => {
    it('stores a PNG and serves it through a signed URL', async () => {
      const response = await authed('put', '/api/v1/me/photo')
        .attach('photo', PNG_BYTES, { filename: 'me.png', contentType: 'image/png' })
        .expect(200);
      const photoUrl: string = response.body.photoUrl;
      expect(photoUrl).toMatch(/^\/api\/v1\/files\/student-photos\/.+\.png\?exp=\d+&sig=/);

      const file = await http().get(photoUrl).expect(200);
      expect(file.headers['content-type']).toBe('image/png');
      await http()
        .get(photoUrl.replace(/sig=[^&]+/, 'sig=tampered'))
        .expect(404);
    });

    it('rejects non-image content regardless of the declared type', async () => {
      const response = await authed('put', '/api/v1/me/photo').attach(
        'photo',
        Buffer.from('<svg></svg>xxxxxx'),
        {
          filename: 'me.png',
          contentType: 'image/png',
        },
      );
      expect(response.status).toBe(422);
      expect(response.body.code).toBe('FILE_INVALID');
    });
  });
});
