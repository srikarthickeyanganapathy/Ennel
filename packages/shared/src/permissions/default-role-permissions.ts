import { StaffRole } from '../enums/staff.js';
import { PERMISSION_KEYS, type PermissionKey } from './permission-keys.js';

/**
 * Default role → permission map (Admin §A, docs/rbac-matrix.md). Seeded into
 * `role_permissions`; afterwards only a Super Admin changes it.
 * Entries marked "assumption" are approved defaults still to be confirmed with mess management.
 */
export const DEFAULT_ROLE_PERMISSIONS: Readonly<Record<StaffRole, readonly PermissionKey[]>> = {
  [StaffRole.SUPER_ADMIN]: PERMISSION_KEYS,
  [StaffRole.MESS_MANAGER]: [
    'dashboard:read',
    'dashboard:read-today',
    'policy:read',
    'mess-config:read',
    'mess-config:update',
    'menus:read',
    'menus:update',
    'menus:publish',
    'closures:read',
    'closures:manage',
    'students:read', // assumption: needed to book on a student's behalf
    'bookings:read',
    'bookings:override',
    'bookings:bulk',
    'attendance:read',
    'attendance:mark',
    'attendance:import',
    'attendance:outage-toggle',
    'no-shows:read',
    'no-shows:review-appeal',
    'no-shows:reset',
    'leaves:read',
    'leaves:approve',
    'leaves:manage',
    'complaints:read',
    'complaints:resolve',
    'complaints:note',
    'complaints:assign',
    'announcements:read',
    'announcements:manage',
    'forecasting:read',
    'forecasting:export',
    'reports:read',
    'reports:export',
    'system:read', // assumption
  ],
  [StaffRole.MESS_STAFF]: [
    'dashboard:read-today',
    'mess-config:read',
    'menus:read',
    'closures:read',
    'attendance:read',
    'attendance:mark',
    'forecasting:read',
    'forecasting:export',
  ],
  [StaffRole.WARDEN]: [
    'dashboard:read-today',
    'policy:read',
    'menus:read',
    'closures:read',
    'students:read',
    'leaves:read',
    'leaves:approve',
    'complaints:read',
    'complaints:resolve',
    'complaints:note',
    'reports:read',
    'reports:export', // assumption
  ],
  [StaffRole.AUDITOR]: [
    'policy:read',
    'reports:read',
    'reports:export',
    'audit-log:read',
    'audit-log:export',
  ],
};
