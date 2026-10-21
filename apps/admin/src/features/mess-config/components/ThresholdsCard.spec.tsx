import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { mockAuth } from '@/test-utils/mock-auth';
import { renderWithProviders } from '@/test-utils/render';
import { getThresholds } from '../api/mess-config-api';
import { ThresholdsCard } from './ThresholdsCard';

let auth = mockAuth([]);
vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => auth,
  usePermissions:
    () =>
    (...keys: string[]) =>
      keys.every((key) => auth.permissions.has(key as never)),
}));
vi.mock('../api/mess-config-api', () => ({ getThresholds: vi.fn(), updateThresholds: vi.fn() }));

const THRESHOLDS = { fillingFastThresholdPct: 70, recommendedMaxOccupancyPct: 60, version: 3 };

describe('ThresholdsCard (Admin §D, ADR-0013)', () => {
  it('shows the thresholds read-only to Mess Staff (mess-config:read only)', async () => {
    auth = mockAuth(['mess-config:read']);
    vi.mocked(getThresholds).mockResolvedValue(THRESHOLDS);
    renderWithProviders(<ThresholdsCard />);
    await waitFor(() =>
      expect(screen.getByLabelText('Filling Fast at (% occupancy)')).toHaveValue(70),
    );
    expect(screen.getByLabelText('Filling Fast at (% occupancy)')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save thresholds' })).not.toBeInTheDocument();
  });

  it('lets a Mess Manager edit them', async () => {
    auth = mockAuth(['mess-config:read', 'mess-config:update']);
    vi.mocked(getThresholds).mockResolvedValue(THRESHOLDS);
    renderWithProviders(<ThresholdsCard />);
    await waitFor(() =>
      expect(screen.getByLabelText('Recommended up to (% occupancy)')).toHaveValue(60),
    );
    expect(screen.getByLabelText('Filling Fast at (% occupancy)')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save thresholds' })).toBeInTheDocument();
  });
});
