import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { mockAuth } from '@/test-utils/mock-auth';
import { renderWithProviders } from '@/test-utils/render';
import { getPolicy } from '../api/mess-config-api';
import { ThresholdsCard } from './ThresholdsCard';

let auth = mockAuth([]);
vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => auth,
  usePermissions:
    () =>
    (...keys: string[]) =>
      keys.every((key) => auth.permissions.has(key as never)),
}));
vi.mock('../api/mess-config-api', () => ({ getPolicy: vi.fn(), updateThresholds: vi.fn() }));

const POLICY = {
  allowOverCapacityBooking: false,
  defaultSlotFullFallback: 'ASK_STUDENT',
  leaveRequiresApproval: false,
  complaintPrivacyMode: 'PRIVATE_IDENTIFIED',
  noShowWindowDays: 30,
  noShowWarningThreshold: 2,
  noShowDisableThreshold: 3,
  cancellationCutoffMinutes: 60,
  bookingHorizonDays: 7,
  dietTypeChangeCutoffMinutes: 120,
  fillingFastThresholdPct: 70,
  recommendedMaxOccupancyPct: 60,
  forecastLookbackDays: 14,
  collegeControlledFields: [],
  version: 3,
  updatedAt: '2026-10-20T06:00:00.000Z',
  updatedByName: null,
} as const;

describe('ThresholdsCard (Admin §D, ADR-0013)', () => {
  it('does not call GET /policy for a role without policy:read (Mess Staff)', () => {
    auth = mockAuth(['mess-config:read']);
    renderWithProviders(<ThresholdsCard />);
    expect(getPolicy).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Availability labels')).not.toBeInTheDocument();
  });

  it('shows the thresholds to a Mess Manager', async () => {
    auth = mockAuth(['mess-config:read', 'mess-config:update', 'policy:read']);
    vi.mocked(getPolicy).mockResolvedValue({ ...POLICY, collegeControlledFields: [] });
    renderWithProviders(<ThresholdsCard />);
    await waitFor(() =>
      expect(screen.getByLabelText('Filling Fast at (% occupancy)')).toHaveValue(70),
    );
    expect(screen.getByRole('button', { name: 'Save thresholds' })).toBeInTheDocument();
  });
});
