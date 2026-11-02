import { type PendingWork, type PermissionKey } from '@ennel/shared';
import {
  Activity,
  BarChart3,
  Briefcase,
  Building2,
  CalendarCheck2,
  CalendarX2,
  LayoutDashboard,
  MessageSquare,
  Rows3,
  ScrollText,
  Settings,
  Shield,
  TrendingUp,
  Users,
  Utensils,
} from 'lucide-react';
import { type ComponentType } from 'react';
import announcementsIcon from '@/assets/icons/announcements.svg';
import attendanceIcon from '@/assets/icons/attendance.svg';
import { maskIcon } from './MaskIcon';

export interface NavItem {
  label: string;
  path: string;
  /** Shown when the staff member has any of these (Admin UX: permission-aware sidebar). */
  anyOf: PermissionKey[];
  icon: ComponentType<{ className?: string }>;
  /** Figma sidebar groups: day-to-day work first, then setup under "Admin". */
  section: 'main' | 'admin';
  /** Pending-work count shown as a badge, from `GET /admin/dashboard/pending`. */
  badge?: (pending: PendingWork) => number;
}

/*
 * Icons follow the Figma sidebar. Where the design has an icon, the installed Lucide icon with the
 * same shape is used; Attendance and Announcements have no exact Lucide match in this version, so
 * the Figma files are used. Pages the design does not show (Bookings, Closures, Hostels,
 * Audit log) use Lucide icons in the same style.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/',
    anyOf: ['dashboard:read', 'dashboard:read-today'],
    icon: LayoutDashboard,
    section: 'main',
  },
  {
    label: 'Meal forecast',
    path: '/forecast',
    anyOf: ['forecasting:read'],
    icon: TrendingUp,
    section: 'main',
  },
  {
    label: 'Bookings',
    path: '/bookings',
    anyOf: ['bookings:read'],
    icon: CalendarCheck2,
    section: 'main',
  },
  {
    label: 'Attendance',
    path: '/attendance',
    anyOf: ['attendance:read', 'no-shows:read'],
    icon: maskIcon(attendanceIcon),
    section: 'main',
    badge: (pending) => pending.noShowAppeals + pending.attendanceIssues,
  },
  {
    label: 'Leaves',
    path: '/leaves',
    anyOf: ['leaves:read'],
    icon: Briefcase,
    section: 'main',
    badge: (pending) => pending.leaveApprovals,
  },
  {
    label: 'Complaints',
    path: '/complaints',
    anyOf: ['complaints:read'],
    icon: MessageSquare,
    section: 'main',
    badge: (pending) => pending.openComplaints,
  },
  {
    label: 'Announcements',
    path: '/announcements',
    anyOf: ['announcements:read'],
    icon: maskIcon(announcementsIcon),
    section: 'main',
  },
  {
    label: 'Students',
    path: '/students',
    anyOf: ['students:read', 'roster:import'],
    icon: Users,
    section: 'main',
  },
  { label: 'Menu', path: '/menus', anyOf: ['menus:read'], icon: Utensils, section: 'main' },
  {
    label: 'Closures',
    path: '/closures',
    anyOf: ['closures:read'],
    icon: CalendarX2,
    section: 'main',
  },
  {
    label: 'Slots & capacity',
    path: '/mess-config',
    anyOf: ['mess-config:read'],
    icon: Rows3,
    section: 'admin',
  },
  {
    label: 'Hostels',
    path: '/hostels',
    anyOf: ['mess-config:read'],
    icon: Building2,
    section: 'admin',
  },
  {
    label: 'Settings & rules',
    path: '/policy',
    anyOf: ['policy:read'],
    icon: Settings,
    section: 'admin',
  },
  {
    label: 'Reports',
    path: '/reports',
    anyOf: ['reports:read'],
    icon: BarChart3,
    section: 'admin',
  },
  {
    label: 'Staff & roles',
    path: '/staff',
    anyOf: ['staff:read', 'roles:manage'],
    icon: Shield,
    section: 'admin',
  },
  {
    label: 'System health',
    path: '/system',
    anyOf: ['system:read'],
    icon: Activity,
    section: 'admin',
  },
  {
    label: 'Audit log',
    path: '/audit-log',
    anyOf: ['audit-log:read'],
    icon: ScrollText,
    section: 'admin',
  },
];

export function getVisibleNavItems(granted: ReadonlySet<PermissionKey>): NavItem[] {
  return NAV_ITEMS.filter((item) => item.anyOf.some((key) => granted.has(key)));
}
