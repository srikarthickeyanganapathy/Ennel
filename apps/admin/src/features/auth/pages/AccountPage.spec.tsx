import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/api-client/api-error';
import { mockAuth } from '@/test-utils/mock-auth';
import { renderWithProviders } from '@/test-utils/render';
import { enrollTotp, listSessions } from '../api/auth-api';
import { AccountPage } from './AccountPage';

const auth = mockAuth([], { roles: ['MESS_MANAGER'] });
vi.mock('@/features/auth/auth-context', () => ({ useAuth: () => auth }));
vi.mock('../api/auth-api', () => ({
  confirmTotp: vi.fn(),
  enrollTotp: vi.fn(),
  listSessions: vi.fn(),
  revokeAllSessions: vi.fn(),
}));

describe('AccountPage (Admin §B)', () => {
  it('shows role names and reports a failed two-factor setup', async () => {
    vi.mocked(listSessions).mockResolvedValue([]);
    vi.mocked(enrollTotp).mockRejectedValue(
      new ApiError('RATE_LIMITED', 'Too many attempts. Try again in a minute.', 429),
    );
    renderWithProviders(<AccountPage />);

    expect(screen.getByText('Roles: Mess Manager')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Set up two-factor sign-in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many attempts. Try again in a minute.',
    );
  });
});
