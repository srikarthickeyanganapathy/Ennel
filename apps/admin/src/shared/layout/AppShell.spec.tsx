import { DEFAULT_ROLE_PERMISSIONS } from '@ennel/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { mockAuth } from '@/test-utils/mock-auth';
import { getPendingWork } from '@/features/dashboard/api/dashboard-api';
import { AppShell } from './AppShell';

let auth = mockAuth([...DEFAULT_ROLE_PERMISSIONS.WARDEN]);
vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => auth,
  usePermissions:
    () =>
    (...keys: string[]) =>
      keys.every((key) => auth.permissions.has(key as never)),
}));
vi.mock('@/features/dashboard/api/dashboard-api', () => ({ getPendingWork: vi.fn() }));

function renderShell() {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppShell />,
        children: [{ index: true, element: <h1>Dashboard</h1> }],
      },
    ],
    { initialEntries: ['/'] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('AppShell', () => {
  it('shows only the pages the role can open, the user, and the routed page', () => {
    vi.mocked(getPendingWork).mockResolvedValue({
      leaveApprovals: 0,
      openComplaints: 0,
      noShowAppeals: 0,
      attendanceIssues: 0,
    });
    renderShell();

    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav).toHaveTextContent('Students');
    expect(nav).not.toHaveTextContent('Staff & roles');
    expect(nav).not.toHaveTextContent('Audit log');
    expect(screen.getByRole('button', { name: 'Account menu' })).toHaveTextContent('Test Warden');
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('badges the pages with pending work and groups setup pages under Admin', async () => {
    auth = mockAuth([...DEFAULT_ROLE_PERMISSIONS.MESS_MANAGER]);
    vi.mocked(getPendingWork).mockResolvedValue({
      leaveApprovals: 6,
      openComplaints: 3,
      noShowAppeals: 1,
      attendanceIssues: 1,
    });
    renderShell();

    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(await within(nav).findByRole('link', { name: 'Leaves, 6 waiting' })).toHaveAttribute(
      'href',
      '/leaves',
    );
    expect(within(nav).getByRole('link', { name: 'Complaints, 3 waiting' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Attendance, 2 waiting' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Announcements' })).toBeInTheDocument();
    expect(within(nav).getByText('Admin')).toBeInTheDocument();
    auth = mockAuth([...DEFAULT_ROLE_PERMISSIONS.WARDEN]);
  });

  it('asks for no counts when the role has no dashboard', () => {
    auth = mockAuth([...DEFAULT_ROLE_PERMISSIONS.AUDITOR]);
    vi.mocked(getPendingWork).mockClear();
    renderShell();
    expect(getPendingWork).not.toHaveBeenCalled();
    auth = mockAuth([...DEFAULT_ROLE_PERMISSIONS.WARDEN]);
  });
});
