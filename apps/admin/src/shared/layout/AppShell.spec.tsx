import { DEFAULT_ROLE_PERMISSIONS } from '@ennel/shared';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { mockAuth } from '@/test-utils/mock-auth';
import { AppShell } from './AppShell';

const auth = mockAuth([...DEFAULT_ROLE_PERMISSIONS.WARDEN]);
vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => auth,
  usePermissions:
    () =>
    (...keys: string[]) =>
      keys.every((key) => auth.permissions.has(key as never)),
}));

describe('AppShell', () => {
  it('shows only the pages the role can open, the user, and the routed page', () => {
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
    render(<RouterProvider router={router} />);

    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav).toHaveTextContent('Students');
    expect(nav).not.toHaveTextContent('Staff & roles');
    expect(nav).not.toHaveTextContent('Audit log');
    expect(screen.getByRole('button', { name: 'Account menu' })).toHaveTextContent('Test Warden');
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });
});
