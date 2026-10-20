import { z } from 'zod';
import { PERMISSION_KEYS } from '../../permissions/permission-keys.js';
import { PASSWORD_MAX_LENGTH } from '../auth.schema.js';

export const STAFF_PASSWORD_MIN_LENGTH = 12;

/** BR-AUTH-3 staff password policy; "not equal to the email" is checked by the API. */
export const staffPasswordSchema = z
  .string()
  .min(STAFF_PASSWORD_MIN_LENGTH, `Use at least ${STAFF_PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters`);

export const staffEmailSchema = z
  .email('Enter a valid email address')
  .trim()
  .toLowerCase()
  .max(200);

export const staffLoginRequestSchema = z.object({
  email: staffEmailSchema,
  password: z.string().min(1, 'Enter your password').max(PASSWORD_MAX_LENGTH),
});
export type StaffLoginRequest = z.input<typeof staffLoginRequestSchema>;

/** The refresh token travels only in an httpOnly cookie (ADR-0015). */
export const staffSessionSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: z.iso.datetime(),
  mustChangePassword: z.boolean(),
});
export type StaffSession = z.infer<typeof staffSessionSchema>;

export const staffLoginResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('AUTHENTICATED'), session: staffSessionSchema }),
  z.object({ status: z.literal('TOTP_REQUIRED'), challengeToken: z.string() }),
]);
export type StaffLoginResponse = z.infer<typeof staffLoginResponseSchema>;

export const totpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app');

export const totpLoginRequestSchema = z.object({
  challengeToken: z.string().min(10),
  code: totpCodeSchema,
});
export type TotpLoginRequest = z.input<typeof totpLoginRequestSchema>;

export const changePasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password').max(PASSWORD_MAX_LENGTH),
    newPassword: staffPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });
export type ChangePasswordRequest = z.input<typeof changePasswordRequestSchema>;

export const staffMeSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  fullName: z.string(),
  roles: z.array(z.string()),
  permissions: z.array(z.enum(PERMISSION_KEYS)),
  mustChangePassword: z.boolean(),
  totpEnabled: z.boolean(),
});
export type StaffMe = z.infer<typeof staffMeSchema>;

export const staffSessionItemSchema = z.object({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime().nullable(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  isCurrent: z.boolean(),
});
export type StaffSessionItem = z.infer<typeof staffSessionItemSchema>;
export const staffSessionListSchema = z.object({ items: z.array(staffSessionItemSchema) });

export const totpEnrollmentSchema = z.object({ secret: z.string(), otpauthUrl: z.string() });
export type TotpEnrollment = z.infer<typeof totpEnrollmentSchema>;
export const totpConfirmRequestSchema = z.object({ code: totpCodeSchema });
