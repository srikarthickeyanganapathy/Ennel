import { z } from 'zod';
import { StaffRole } from '../../enums/staff.js';
import { PERMISSION_KEYS } from '../../permissions/permission-keys.js';
import { overrideReasonSchema, paginationQuerySchema } from '../common.schema.js';
import { staffEmailSchema } from './staff-auth.schema.js';

export const staffRoleSchema = z.enum([
  StaffRole.SUPER_ADMIN,
  StaffRole.MESS_MANAGER,
  StaffRole.MESS_STAFF,
  StaffRole.WARDEN,
  StaffRole.AUDITOR,
]);

export const STAFF_STATUSES = ['ACTIVE', 'LOCKED', 'DISABLED'] as const;

export const staffListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(STAFF_STATUSES).optional(),
  role: staffRoleSchema.optional(),
});
export type StaffListQuery = z.input<typeof staffListQuerySchema>;

export const staffUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  fullName: z.string(),
  status: z.enum(STAFF_STATUSES),
  roles: z.array(staffRoleSchema),
  mustChangePassword: z.boolean(),
  totpEnabled: z.boolean(),
  lockedUntil: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  version: z.number().int(),
});
export type StaffUser = z.infer<typeof staffUserSchema>;

export const staffFullNameSchema = z.string().trim().min(2, 'Enter the full name').max(120);

export const createStaffRequestSchema = z.object({
  email: staffEmailSchema,
  fullName: staffFullNameSchema,
  roles: z.array(staffRoleSchema).min(1, 'Choose at least one role'),
});
export type CreateStaffRequest = z.input<typeof createStaffRequestSchema>;

/** The temporary password is shown once; it must be changed on first sign-in (Admin §B). */
export const staffWithTemporaryPasswordSchema = z.object({
  staff: staffUserSchema,
  temporaryPassword: z.string(),
});
export type StaffWithTemporaryPassword = z.infer<typeof staffWithTemporaryPasswordSchema>;

export const updateStaffRequestSchema = z.object({
  fullName: staffFullNameSchema,
  version: z.number().int().min(1),
});

export const setStaffRolesRequestSchema = z.object({
  roles: z.array(staffRoleSchema).min(1, 'Choose at least one role'),
  reason: overrideReasonSchema,
  version: z.number().int().min(1),
});

export const reasonRequestSchema = z.object({ reason: overrideReasonSchema });
export type ReasonRequest = z.input<typeof reasonRequestSchema>;

export const roleSchema = z.object({
  id: z.uuid(),
  key: staffRoleSchema,
  name: z.string(),
  isSystem: z.boolean(),
  permissions: z.array(z.enum(PERMISSION_KEYS)),
  staffCount: z.number().int(),
});
export type Role = z.infer<typeof roleSchema>;

export const updateRolePermissionsRequestSchema = z.object({
  permissions: z.array(z.enum(PERMISSION_KEYS)),
  reason: overrideReasonSchema,
});
export type UpdateRolePermissionsRequest = z.input<typeof updateRolePermissionsRequestSchema>;
