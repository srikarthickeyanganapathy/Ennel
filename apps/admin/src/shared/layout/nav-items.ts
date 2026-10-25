import { type PermissionKey } from '@ennel/shared';

export interface NavItem {
  label: string;
  path: string;
  /** Shown when the staff member has any of these (Admin UX: permission-aware sidebar). */
  anyOf: PermissionKey[];
}

// Only pages that exist are listed; later phases add theirs (attendance, leaves, ...).
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/', anyOf: ['dashboard:read', 'dashboard:read-today'] },
  { label: 'Bookings', path: '/bookings', anyOf: ['bookings:read'] },
  { label: 'Attendance', path: '/attendance', anyOf: ['attendance:read'] },
  { label: 'Students', path: '/students', anyOf: ['students:read', 'roster:import'] },
  { label: 'Menus', path: '/menus', anyOf: ['menus:read'] },
  { label: 'Closures', path: '/closures', anyOf: ['closures:read'] },
  { label: 'Mess configuration', path: '/mess-config', anyOf: ['mess-config:read'] },
  { label: 'Hostels', path: '/hostels', anyOf: ['mess-config:read'] },
  { label: 'Policy', path: '/policy', anyOf: ['policy:read'] },
  { label: 'Staff & roles', path: '/staff', anyOf: ['staff:read', 'roles:manage'] },
  { label: 'Audit log', path: '/audit-log', anyOf: ['audit-log:read'] },
];

export function getVisibleNavItems(granted: ReadonlySet<PermissionKey>): NavItem[] {
  return NAV_ITEMS.filter((item) => item.anyOf.some((key) => granted.has(key)));
}
