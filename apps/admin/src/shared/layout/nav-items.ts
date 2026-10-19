import { type PermissionKey } from '@ennel/shared';

export interface NavItem {
  label: string;
  path: string;
  /** Shown when the staff member has any of these (Admin UX: permission-aware sidebar). */
  anyOf: PermissionKey[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/', anyOf: ['dashboard:read', 'dashboard:read-today'] },
  { label: 'Bookings', path: '/bookings', anyOf: ['bookings:read'] },
  { label: 'Attendance', path: '/attendance', anyOf: ['attendance:read'] },
  { label: 'Students', path: '/students', anyOf: ['students:read'] },
  { label: 'Leaves', path: '/leaves', anyOf: ['leaves:read'] },
  { label: 'No-shows', path: '/no-shows', anyOf: ['no-shows:read'] },
  { label: 'Complaints', path: '/complaints', anyOf: ['complaints:read'] },
  { label: 'Menus', path: '/menus', anyOf: ['menus:read'] },
  { label: 'Closures', path: '/closures', anyOf: ['closures:read'] },
  { label: 'Announcements', path: '/announcements', anyOf: ['announcements:read'] },
  { label: 'Forecasting', path: '/forecasting', anyOf: ['forecasting:read'] },
  { label: 'Reports', path: '/reports', anyOf: ['reports:read'] },
  { label: 'Mess configuration', path: '/mess-config', anyOf: ['mess-config:read'] },
  { label: 'Policy', path: '/policy', anyOf: ['policy:read'] },
  { label: 'Staff & roles', path: '/staff', anyOf: ['staff:read', 'roles:manage'] },
  { label: 'Audit log', path: '/audit-log', anyOf: ['audit-log:read'] },
  { label: 'System health', path: '/system', anyOf: ['system:read'] },
];

export function getVisibleNavItems(granted: ReadonlySet<PermissionKey>): NavItem[] {
  return NAV_ITEMS.filter((item) => item.anyOf.some((key) => granted.has(key)));
}
