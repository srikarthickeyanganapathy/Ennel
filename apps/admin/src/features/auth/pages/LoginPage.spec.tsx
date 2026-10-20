import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { RequireAuth } from '@/app/route-guards';
import { mockAuth } from '@/test-utils/mock-auth';
import { login, verifyTotp } from '../api/auth-api';
import { LoginPage } from './LoginPage';

let auth = { ...mockAuth([]), status: 'signedOut' as 'signedOut' | 'signedIn' };
vi.mock('@/features/auth/auth-context', () => ({ useAuth: () => auth }));
vi.mock('../api/auth-api', () => ({ login: vi.fn(), verifyTotp: vi.fn() }));

const SESSION = {
  accessToken: 'token',
  accessTokenExpiresAt: '2026-10-20T06:00:00.000Z',
  mustChangePassword: false,
};

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: '/', element: <h1>Home</h1> },
          { path: '/change-password', element: <h1>Change password</h1> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('staff sign-in (Admin §B)', () => {
  it('asks for a TOTP code when two-factor sign-in is on', async () => {
    vi.mocked(login).mockResolvedValue({
      status: 'TOTP_REQUIRED',
      challengeToken: 'challenge-token-1',
    });
    vi.mocked(verifyTotp).mockResolvedValue(SESSION);
    renderAt('/login');

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'warden@ennel.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a-long-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    const code = await screen.findByLabelText('Authenticator code');
    fireEvent.change(code, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() => expect(auth.startSession).toHaveBeenCalledWith(SESSION));
    expect(vi.mocked(verifyTotp).mock.calls[0]?.[0]).toEqual({
      challengeToken: 'challenge-token-1',
      code: '123456',
    });
  });

  it('validates the form before calling the API', async () => {
    renderAt('/login');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('sends signed-out visitors to the login page', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: 'ENNEL staff sign-in' })).toBeInTheDocument();
  });

  it('sends staff with a pending password change to that page first', () => {
    auth = { ...mockAuth([], { mustChangePassword: true }), status: 'signedIn' };
    renderAt('/');
    expect(screen.getByRole('heading', { name: 'Change password' })).toBeInTheDocument();
  });
});
