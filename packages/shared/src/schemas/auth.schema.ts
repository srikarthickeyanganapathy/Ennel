import { z } from 'zod';
import { isValidReferenceNumber, normalizeReferenceNumber } from '../rules/reference-number.js';

/** BR-AUTH-1: accepts "24 900 417" and yields "24900417". */
export const referenceNumberSchema = z
  .string()
  .trim()
  .min(1, 'Enter your college reference number')
  .transform(normalizeReferenceNumber)
  .refine(isValidReferenceNumber, {
    message: 'Enter the reference number exactly as issued by your college',
  });

export const STUDENT_PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** BR-AUTH-3 student password policy. */
export const studentPasswordSchema = z
  .string()
  .min(STUDENT_PASSWORD_MIN_LENGTH, `Use at least ${STUDENT_PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters`);

export const rosterCheckRequestSchema = z.object({ referenceNumber: referenceNumberSchema });
export type RosterCheckRequest = z.input<typeof rosterCheckRequestSchema>;

export const RosterCheckStatus = { NEW: 'NEW', REGISTERED: 'REGISTERED' } as const;
export type RosterCheckStatus = (typeof RosterCheckStatus)[keyof typeof RosterCheckStatus];

export const rosterCheckResponseSchema = z.object({
  status: z.enum([RosterCheckStatus.NEW, RosterCheckStatus.REGISTERED]),
});
export type RosterCheckResponse = z.infer<typeof rosterCheckResponseSchema>;

/** Spec §3 Screen 3. */
export const registerRequestSchema = z
  .object({
    referenceNumber: referenceNumberSchema,
    password: studentPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });
export type RegisterRequest = z.input<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  referenceNumber: referenceNumberSchema,
  password: z.string().min(1, 'Enter your password').max(PASSWORD_MAX_LENGTH),
});
export type LoginRequest = z.input<typeof loginRequestSchema>;

export const refreshRequestSchema = z.object({ refreshToken: z.string().min(20).max(200) });
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

export const logoutRequestSchema = refreshRequestSchema;

export const authSessionSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: z.iso.datetime(),
  refreshToken: z.string(),
  refreshTokenExpiresAt: z.iso.datetime(),
  /** Spec §3 Screen 4: first-time users go to profile completion, not Home. */
  isOnboardingComplete: z.boolean(),
});
export type AuthSession = z.infer<typeof authSessionSchema>;
