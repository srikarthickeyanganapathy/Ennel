import { describe, expect, it } from 'vitest';
import { loginRequestSchema, referenceNumberSchema, registerRequestSchema } from './auth.schema.js';
import { completeOnboardingRequestSchema } from './onboarding.schema.js';
import { phoneSchema, updateProfileRequestSchema } from './profile.schema.js';

describe('referenceNumberSchema (BR-AUTH-1)', () => {
  it('normalizes spaces and hyphens to digits', () => {
    expect(referenceNumberSchema.parse(' 24 900 417 ')).toBe('24900417');
    expect(referenceNumberSchema.parse('24-900-417')).toBe('24900417');
  });

  it('rejects letters and too-short values', () => {
    expect(referenceNumberSchema.safeParse('24A900').success).toBe(false);
    expect(referenceNumberSchema.safeParse('123').success).toBe(false);
    expect(referenceNumberSchema.safeParse('').success).toBe(false);
  });
});

describe('registerRequestSchema (Spec §3 Screen 3)', () => {
  const base = {
    referenceNumber: '24900417',
    password: 'longenough',
    confirmPassword: 'longenough',
  };

  it('accepts matching passwords of at least 8 characters', () => {
    expect(registerRequestSchema.safeParse(base).success).toBe(true);
  });

  it('reports "Passwords do not match." on the confirmation field', () => {
    const result = registerRequestSchema.safeParse({ ...base, confirmPassword: 'different1' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ['confirmPassword'],
      message: 'Passwords do not match.',
    });
  });

  it('rejects passwords shorter than 8 characters', () => {
    const result = registerRequestSchema.safeParse({
      ...base,
      password: 'short',
      confirmPassword: 'short',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginRequestSchema', () => {
  it('does not apply the creation password policy to login', () => {
    expect(
      loginRequestSchema.safeParse({ referenceNumber: '24900417', password: 'x' }).success,
    ).toBe(true);
  });
});

describe('profile schemas', () => {
  it('normalizes phone numbers', () => {
    expect(phoneSchema.parse('+91 98765-43210')).toBe('+919876543210');
    expect(phoneSchema.safeParse('12ab').success).toBe(false);
  });

  it('rejects unknown profile fields', () => {
    expect(updateProfileRequestSchema.safeParse({ version: 1, referenceNumber: '1' }).success).toBe(
      false,
    );
  });
});

describe('completeOnboardingRequestSchema', () => {
  const preferences = [
    { mealType: 'BREAKFAST', isEnabled: false, slotId: null, dietType: 'VEG' },
    {
      mealType: 'LUNCH',
      isEnabled: true,
      slotId: '6f1c3b9e-8f8a-4b9e-9d5b-1c2d3e4f5a6b',
      dietType: 'VEG',
    },
    {
      mealType: 'DINNER',
      isEnabled: true,
      slotId: '7f1c3b9e-8f8a-4b9e-9d5b-1c2d3e4f5a6b',
      dietType: 'NON_VEG',
    },
  ];
  const profile = {
    hostelBlockId: '8f1c3b9e-8f8a-4b9e-9d5b-1c2d3e4f5a6b',
    roomNumber: '323',
    phone: '9876543210',
    parentPhone: '9876543211',
  };

  it('accepts one preference per meal', () => {
    const result = completeOnboardingRequestSchema.safeParse({
      profile,
      defaultBookingEnabled: true,
      mealPreferences: preferences,
    });
    expect(result.success).toBe(true);
  });

  it('rejects duplicate meals', () => {
    const result = completeOnboardingRequestSchema.safeParse({
      profile,
      defaultBookingEnabled: true,
      mealPreferences: [preferences[0], preferences[0], preferences[1]],
    });
    expect(result.success).toBe(false);
  });
});
