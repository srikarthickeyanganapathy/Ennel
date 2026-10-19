import { createBrowserRouter } from 'react-router';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { AppShell } from '@/shared/layout/AppShell';

// The auth guard and permission-aware routes arrive with staff auth in Phase 2.
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <AppShell />,
    children: [{ index: true, element: <DashboardPage /> }],
  },
]);
