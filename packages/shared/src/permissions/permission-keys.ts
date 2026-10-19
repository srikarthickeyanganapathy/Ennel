/**
 * Every staff permission, defined once (Admin §A). The DB `permissions` table is synced
 * from this list by the seed. Meanings: docs/rbac-matrix.md.
 */
export const PERMISSION_KEYS = [
  'dashboard:read',
  'dashboard:read-today',
  'staff:read',
  'staff:manage',
  'roles:manage',
  'policy:read',
  'policy:update',
  'mess-config:read',
  'mess-config:update',
  'menus:read',
  'menus:update',
  'menus:publish',
  'closures:read',
  'closures:manage',
  'students:read',
  'students:update',
  'students:lock',
  'students:deactivate',
  'students:reset-credentials',
  'roster:import',
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
  'audit-log:read',
  'audit-log:export',
  'system:read',
  'system:manage',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

const PERMISSION_KEY_SET: ReadonlySet<string> = new Set(PERMISSION_KEYS);

export function isPermissionKey(value: string): value is PermissionKey {
  return PERMISSION_KEY_SET.has(value);
}
