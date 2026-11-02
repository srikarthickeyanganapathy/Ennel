import { createBrowserRouter, Navigate } from 'react-router';
import { AuditLogPage } from '@/features/audit-log/pages/AuditLogPage';
import { AccountPage } from '@/features/auth/pages/AccountPage';
import { ChangePasswordPage } from '@/features/auth/pages/ChangePasswordPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { HostelsPage } from '@/features/mess-config/pages/HostelsPage';
import { MessConfigPage } from '@/features/mess-config/pages/MessConfigPage';
import { MenusPage } from '@/features/menus/pages/MenusPage';
import { PolicyPage } from '@/features/policy/pages/PolicyPage';
import { RolesPage } from '@/features/staff/pages/RolesPage';
import { StaffPage } from '@/features/staff/pages/StaffPage';
import { RosterImportPage } from '@/features/students/pages/RosterImportPage';
import { StudentDetailPage } from '@/features/students/pages/StudentDetailPage';
import { StudentsPage } from '@/features/students/pages/StudentsPage';
import { AppShell } from '@/shared/layout/AppShell';
import { BookingsPage } from '@/features/bookings/pages/BookingsPage';
import { ClosuresPage } from '@/features/closures/pages/ClosuresPage';
import { AttendancePage } from '@/features/attendance/pages/AttendancePage';
import { LeavesPage } from '@/features/leaves/pages/LeavesPage';
import { ComplaintsPage } from '@/features/complaints/pages/ComplaintsPage';
import { AnnouncementsPage } from '@/features/announcements/pages/AnnouncementsPage';
import { RequireAuth, RequirePermission } from './route-guards';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/change-password', element: <ChangePasswordPage /> },
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'account', element: <AccountPage /> },
          {
            path: 'bookings',
            element: (
              <RequirePermission anyOf={['bookings:read']}>
                <BookingsPage />
              </RequirePermission>
            ),
          },
          {
            path: 'attendance',
            element: (
              <RequirePermission anyOf={['attendance:read', 'no-shows:read']}>
                <AttendancePage />
              </RequirePermission>
            ),
          },
          {
            path: 'leaves',
            element: (
              <RequirePermission anyOf={['leaves:read']}>
                <LeavesPage />
              </RequirePermission>
            ),
          },
          {
            path: 'no-shows',
            // No-shows moved into the Attendance page; old links keep working.
            element: <Navigate to="/attendance?tab=no-shows" replace />,
          },
          {
            path: 'complaints',
            element: (
              <RequirePermission anyOf={['complaints:read']}>
                <ComplaintsPage />
              </RequirePermission>
            ),
          },
          {
            path: 'announcements',
            element: (
              <RequirePermission anyOf={['announcements:read']}>
                <AnnouncementsPage />
              </RequirePermission>
            ),
          },
          {
            path: 'students',
            element: (
              <RequirePermission anyOf={['students:read', 'roster:import']}>
                <StudentsPage />
              </RequirePermission>
            ),
          },
          {
            path: 'students/import',
            element: (
              <RequirePermission anyOf={['roster:import']}>
                <RosterImportPage />
              </RequirePermission>
            ),
          },
          {
            path: 'students/:id',
            element: (
              <RequirePermission anyOf={['students:read']}>
                <StudentDetailPage />
              </RequirePermission>
            ),
          },
          {
            path: 'menus',
            element: (
              <RequirePermission anyOf={['menus:read']}>
                <MenusPage />
              </RequirePermission>
            ),
          },
          {
            path: 'closures',
            element: (
              <RequirePermission anyOf={['closures:read']}>
                {' '}
                <ClosuresPage />{' '}
              </RequirePermission>
            ),
          },
          {
            path: 'mess-config',
            element: (
              <RequirePermission anyOf={['mess-config:read']}>
                <MessConfigPage />
              </RequirePermission>
            ),
          },
          {
            path: 'hostels',
            element: (
              <RequirePermission anyOf={['mess-config:read']}>
                <HostelsPage />
              </RequirePermission>
            ),
          },
          {
            path: 'policy',
            element: (
              <RequirePermission anyOf={['policy:read']}>
                <PolicyPage />
              </RequirePermission>
            ),
          },
          {
            path: 'staff',
            element: (
              <RequirePermission anyOf={['staff:read']}>
                <StaffPage />
              </RequirePermission>
            ),
          },
          {
            path: 'staff/roles',
            element: (
              <RequirePermission anyOf={['roles:manage']}>
                <RolesPage />
              </RequirePermission>
            ),
          },
          {
            path: 'audit-log',
            element: (
              <RequirePermission anyOf={['audit-log:read']}>
                <AuditLogPage />
              </RequirePermission>
            ),
          },
        ],
      },
    ],
  },
]);
