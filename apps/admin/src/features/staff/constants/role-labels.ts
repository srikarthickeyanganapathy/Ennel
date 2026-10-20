import { type StaffRole } from '@ennel/shared';

export const ROLE_LABELS: Record<StaffRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  MESS_MANAGER: 'Mess Manager',
  MESS_STAFF: 'Mess Staff (counter/kitchen)',
  WARDEN: 'Warden',
  AUDITOR: 'Auditor',
};
