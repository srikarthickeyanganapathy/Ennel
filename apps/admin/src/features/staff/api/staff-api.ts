import {
  type CreateStaffRequest,
  type Paginated,
  paginatedResponseSchema,
  type PermissionKey,
  type Role,
  roleSchema,
  type StaffListQuery,
  type StaffRole,
  type StaffUser,
  staffUserSchema,
  type StaffWithTemporaryPassword,
  staffWithTemporaryPasswordSchema,
} from '@ennel/shared';
import { z } from 'zod';
import { apiRequest } from '@/shared/api-client/api-client';

const staffPageSchema = paginatedResponseSchema(staffUserSchema);
const roleListSchema = z.object({ items: z.array(roleSchema) });

export const listStaff = (query: StaffListQuery): Promise<Paginated<StaffUser>> =>
  apiRequest('/staff-users', { query: { ...query }, schema: staffPageSchema });

export const createStaff = (body: CreateStaffRequest): Promise<StaffWithTemporaryPassword> =>
  apiRequest('/staff-users', { method: 'POST', body, schema: staffWithTemporaryPasswordSchema });

export const updateStaff = (id: string, fullName: string, version: number): Promise<StaffUser> =>
  apiRequest(`/staff-users/${id}`, {
    method: 'PATCH',
    body: { fullName, version },
    schema: staffUserSchema,
  });

export const setStaffRoles = (
  id: string,
  roles: StaffRole[],
  reason: string,
  version: number,
): Promise<StaffUser> =>
  apiRequest(`/staff-users/${id}/roles`, {
    method: 'PUT',
    body: { roles, reason, version },
    schema: staffUserSchema,
  });

export const setStaffEnabled = (
  id: string,
  isEnabled: boolean,
  reason: string,
): Promise<StaffUser> =>
  apiRequest(`/staff-users/${id}/${isEnabled ? 'enable' : 'disable'}`, {
    method: 'POST',
    body: { reason },
    schema: staffUserSchema,
  });

export const resetStaffPassword = (
  id: string,
  reason: string,
): Promise<StaffWithTemporaryPassword> =>
  apiRequest(`/staff-users/${id}/reset-password`, {
    method: 'POST',
    body: { reason },
    schema: staffWithTemporaryPasswordSchema,
  });

export const resetStaffTotp = (id: string, reason: string): Promise<void> =>
  apiRequest(`/staff-users/${id}/reset-totp`, { method: 'POST', body: { reason } });

export const listRoles = async (): Promise<Role[]> =>
  (await apiRequest('/roles', { schema: roleListSchema })).items;

export const updateRolePermissions = (
  id: string,
  permissions: PermissionKey[],
  reason: string,
): Promise<Role> =>
  apiRequest(`/roles/${id}/permissions`, {
    method: 'PUT',
    body: { permissions, reason },
    schema: roleSchema,
  });
