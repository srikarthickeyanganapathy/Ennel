import { type StaffRole } from '@ennel/shared';

export const ROLE_LABELS: Record<StaffRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  MESS_MANAGER: 'Mess Manager',
  MESS_STAFF: 'Mess Staff (counter/kitchen)',
  WARDEN: 'Warden',
  AUDITOR: 'Auditor',
};

const isStaffRole = (role: string): role is StaffRole => Object.hasOwn(ROLE_LABELS, role);

/** Readable names for role keys from /auth/me, which arrive as plain strings. */
export function formatRoles(roles: readonly string[]): string {
  return roles.map((role) => (isStaffRole(role) ? ROLE_LABELS[role] : role)).join(', ');
}
