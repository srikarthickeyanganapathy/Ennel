import { z } from 'zod';
import { registerRequestSchema } from '../auth.schema.js';
import { overrideReasonSchema, paginationQuerySchema, uuidSchema } from '../common.schema.js';
import { dietTypeSchema, mealTypeSchema } from '../meal-config.schema.js';
import { profileFieldSchemas } from '../profile.schema.js';

export const STUDENT_STATUSES = ['ACTIVE', 'LOCKED', 'DEACTIVATED'] as const;

/** Admin §G student list filters. */
export const adminStudentListQuerySchema = paginationQuerySchema.extend({
  hostelId: uuidSchema.optional(),
  hostelBlockId: uuidSchema.optional(),
  academicYear: z.coerce.number().int().min(1).max(8).optional(),
  department: z.string().trim().max(120).optional(),
  registration: z.enum(['REGISTERED', 'UNREGISTERED']).optional(),
  status: z.enum(STUDENT_STATUSES).optional(),
  defaultBooking: z.enum(['ON', 'OFF']).optional(),
});
export type AdminStudentListQuery = z.input<typeof adminStudentListQuerySchema>;

/** Keyed by roster entry, so unregistered students are listed too. */
export const adminStudentListItemSchema = z.object({
  rosterEntryId: uuidSchema,
  studentId: uuidSchema.nullable(),
  referenceNumber: z.string(),
  fullName: z.string(),
  department: z.string(),
  academicYear: z.number().int(),
  hostelBlockId: uuidSchema.nullable(),
  hostelName: z.string().nullable(),
  blockName: z.string().nullable(),
  roomNumber: z.string().nullable(),
  isRegistered: z.boolean(),
  isRosterActive: z.boolean(),
  status: z.enum(STUDENT_STATUSES).nullable(),
  defaultBookingEnabled: z.boolean().nullable(),
});
export type AdminStudentListItem = z.infer<typeof adminStudentListItemSchema>;

export const adminStudentDetailSchema = adminStudentListItemSchema.extend({
  email: z.string().nullable(),
  phone: z.string().nullable(),
  parentPhone: z.string().nullable(),
  registeredAt: z.iso.datetime().nullable(),
  onboardingCompletedAt: z.iso.datetime().nullable(),
  lockedUntil: z.iso.datetime().nullable(),
  preferences: z.array(
    z.object({
      mealType: mealTypeSchema,
      isEnabled: z.boolean(),
      slotLabel: z.string().nullable(),
      dietType: dietTypeSchema,
      isAutoDisabled: z.boolean(),
    }),
  ),
  recentBookings: z.array(
    z.object({
      id: uuidSchema,
      mealDate: z.string(),
      mealType: mealTypeSchema,
      slotLabel: z.string(),
      status: z.string(),
      source: z.string(),
    }),
  ),
  leaves: z.array(
    z.object({
      id: uuidSchema,
      startDate: z.string(),
      startMealType: mealTypeSchema,
      endDate: z.string(),
      endMealType: mealTypeSchema,
      status: z.string(),
    }),
  ),
  noShowCounts: z.record(mealTypeSchema, z.number().int()),
  noShowWindowDays: z.number().int(),
  complaintsCount: z.number().int(),
  rosterVersion: z.number().int(),
});
export type AdminStudentDetail = z.infer<typeof adminStudentDetailSchema>;

/** College-controlled fields staff may correct (Admin §G), always with a reason. */
export const updateAdminStudentRequestSchema = z.object({
  fullName: profileFieldSchemas.fullName.optional(),
  department: profileFieldSchemas.department.optional(),
  academicYear: profileFieldSchemas.academicYear.optional(),
  hostelBlockId: profileFieldSchemas.hostelBlockId.nullable().optional(),
  roomNumber: profileFieldSchemas.roomNumber.nullable().optional(),
  email: profileFieldSchemas.email.nullable().optional(),
  reason: overrideReasonSchema,
  rosterVersion: z.number().int().min(1),
});
export type UpdateAdminStudentRequest = z.input<typeof updateAdminStudentRequestSchema>;

export const bulkHostelRequestSchema = z.object({
  rosterEntryIds: z.array(uuidSchema).min(1).max(500),
  hostelBlockId: uuidSchema,
  reason: overrideReasonSchema,
});
export type BulkHostelRequest = z.input<typeof bulkHostelRequestSchema>;

export const CREDENTIAL_RESET_KINDS = ['PASSWORD', 'REGISTRATION'] as const;

export const credentialResetRequestSchema = z.object({
  kind: z.enum(CREDENTIAL_RESET_KINDS),
  reason: overrideReasonSchema,
});
export type CredentialResetRequest = z.input<typeof credentialResetRequestSchema>;

/** The code is shown to staff once and handed to the student in person (ADR-0019). */
export const credentialResetIssuedSchema = z.object({
  code: z.string(),
  kind: z.enum(CREDENTIAL_RESET_KINDS),
  expiresAt: z.iso.datetime(),
});
export type CredentialResetIssued = z.infer<typeof credentialResetIssuedSchema>;

/** Student side of ADR-0019. */
export const resetWithCodeRequestSchema = registerRequestSchema.safeExtend({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{10}$/, 'Enter the 10-character code from the mess office'),
});
export type ResetWithCodeRequest = z.input<typeof resetWithCodeRequestSchema>;
