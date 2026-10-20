import { z } from 'zod';
import { uuidSchema } from './common.schema.js';

/** Profile fields a student may edit unless policy marks them college-controlled (ADR-0018). */
export const STUDENT_PROFILE_FIELDS = [
  'fullName',
  'department',
  'academicYear',
  'hostelBlockId',
  'roomNumber',
  'phone',
  'parentPhone',
  'email',
] as const;
export type StudentProfileField = (typeof STUDENT_PROFILE_FIELDS)[number];

// Format of local numbers is unconfirmed; accept 7-15 digits with an optional leading +.
export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s()-]/g, ''))
  .refine((value) => /^\+?\d{7,15}$/.test(value), { message: 'Enter a valid phone number' });

export const profileFieldSchemas = {
  fullName: z.string().trim().min(2, 'Enter your full name').max(120),
  department: z.string().trim().min(2, 'Enter your department').max(120),
  academicYear: z.coerce
    .number({ error: 'Enter the year as a number, e.g. 2' })
    .int('Enter a whole year, e.g. 2')
    .min(1, 'Select your year')
    .max(8, 'The year must be 8 or less'),
  hostelBlockId: uuidSchema,
  roomNumber: z.string().trim().min(1, 'Enter your room number').max(20),
  phone: phoneSchema,
  parentPhone: phoneSchema,
  email: z.email('Enter a valid email address').trim().toLowerCase().max(200),
} satisfies Record<StudentProfileField, z.ZodType>;

export const updateProfileRequestSchema = z
  .object({
    fullName: profileFieldSchemas.fullName.optional(),
    department: profileFieldSchemas.department.optional(),
    academicYear: profileFieldSchemas.academicYear.optional(),
    hostelBlockId: profileFieldSchemas.hostelBlockId.optional(),
    roomNumber: profileFieldSchemas.roomNumber.optional(),
    phone: profileFieldSchemas.phone.optional(),
    parentPhone: profileFieldSchemas.parentPhone.optional(),
    email: profileFieldSchemas.email.nullable().optional(),
    /** Optimistic lock (BR-ADM-2 applies the same way to student edits). */
    version: z.number().int().min(1),
  })
  .strict();
export type UpdateProfileRequest = z.input<typeof updateProfileRequestSchema>;

export const studentProfileSchema = z.object({
  id: uuidSchema,
  referenceNumber: z.string(),
  fullName: z.string(),
  department: z.string(),
  academicYear: z.number().int(),
  hostelBlockId: uuidSchema.nullable(),
  hostelName: z.string().nullable(),
  blockName: z.string().nullable(),
  roomNumber: z.string().nullable(),
  phone: z.string().nullable(),
  parentPhone: z.string().nullable(),
  email: z.string().nullable(),
  photoUrl: z.string().nullable(),
  isOnboardingComplete: z.boolean(),
  defaultBookingEnabled: z.boolean(),
  /** Fields the student may change; the rest are read-only in the UI (Spec §9). */
  editableFields: z.array(z.enum(STUDENT_PROFILE_FIELDS)),
  version: z.number().int(),
});
export type StudentProfile = z.infer<typeof studentProfileSchema>;

export const hostelOptionSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  blocks: z.array(z.object({ id: uuidSchema, name: z.string() })),
});
export type HostelOption = z.infer<typeof hostelOptionSchema>;
export const hostelListResponseSchema = z.object({ items: z.array(hostelOptionSchema) });
