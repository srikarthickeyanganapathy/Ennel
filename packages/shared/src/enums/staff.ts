/** Default roles, Admin §A. */
export const StaffRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  MESS_MANAGER: 'MESS_MANAGER',
  MESS_STAFF: 'MESS_STAFF',
  WARDEN: 'WARDEN',
  AUDITOR: 'AUDITOR',
} as const;
export type StaffRole = (typeof StaffRole)[keyof typeof StaffRole];
