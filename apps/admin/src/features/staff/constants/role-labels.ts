import { type StaffRole } from '@ennel/shared';

export const ROLE_LABELS: Record<StaffRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  MESS_MANAGER: 'Mess Manager',
  MESS_STAFF: 'Mess Staff (counter/kitchen)',
  WARDEN: 'Warden',
  AUDITOR: 'Auditor',
};

/** For chips, where the long "counter/kitchen" note does not fit. */
export const ROLE_SHORT_LABELS: Record<StaffRole, string> = {
  ...ROLE_LABELS,
  MESS_STAFF: 'Mess Staff',
};

const isStaffRole = (role: string): role is StaffRole => Object.hasOwn(ROLE_LABELS, role);

/** Readable names for role keys from /auth/me, which arrive as plain strings. */
export function formatRoles(roles: readonly string[]): string {
  return roles.map((role) => (isStaffRole(role) ? ROLE_LABELS[role] : role)).join(', ');
}
