import { type MessPolicyView } from '@ennel/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  getPolicy,
  listPolicyHistory,
  updatePolicy,
} from '@/features/mess-config/api/mess-config-api';
import { mockAuth } from '@/test-utils/mock-auth';
import { renderWithProviders } from '@/test-utils/render';
import { PolicyPage } from './PolicyPage';

const auth = mockAuth(['policy:read', 'policy:update']);
vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => auth,
  usePermissions:
    () =>
    (...keys: string[]) =>
      keys.every((key) => auth.permissions.has(key as never)),
}));
vi.mock('@/features/mess-config/api/mess-config-api', () => ({
  getPolicy: vi.fn(),
  listPolicyHistory: vi.fn(),
  updatePolicy: vi.fn(),
}));

const POLICY: MessPolicyView = {
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
  collegeControlledFields: ['fullName'],
  version: 4,
  updatedAt: '2026-10-20T06:00:00.000Z',
  updatedByName: 'Admin',
};

describe('PolicyPage (Admin §D, rule 8, Figma "Admin — Settings & rules")', () => {
  it('says what a value does as it is typed, and Discard puts it back', async () => {
    vi.mocked(getPolicy).mockResolvedValue(POLICY);
    vi.mocked(listPolicyHistory).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    renderWithProviders(<PolicyPage />);

    const cancel = await screen.findByLabelText('Cancel deadline');
    expect(
      screen.getByText('Students can cancel until 1 hour before their slot.'),
    ).toBeInTheDocument();
    fireEvent.change(cancel, { target: { value: '90' } });
    expect(
      screen.getByText('Students can cancel until 90 minutes before their slot.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(cancel).toHaveValue(60);
    expect(screen.getByRole('button', { name: 'Save rules' })).toBeDisabled();
  });

  it('toggles a rule with its switch and sends only that field', async () => {
    vi.mocked(getPolicy).mockResolvedValue(POLICY);
    vi.mocked(listPolicyHistory).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    vi.mocked(updatePolicy).mockResolvedValue({ ...POLICY, leaveRequiresApproval: true });
    renderWithProviders(<PolicyPage />);

    fireEvent.click(await screen.findByRole('switch', { name: 'Leave requires staff approval' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save 1 change' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Reason (recorded in the audit log)'), {
      target: { value: 'Warden request' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save rules' }));
    await waitFor(() =>
      expect(updatePolicy).toHaveBeenCalledWith({
        leaveRequiresApproval: true,
        reason: 'Warden request',
        version: 4,
      }),
    );
  });

  it('only allows saving after a change and sends just the changed fields', async () => {
    vi.mocked(getPolicy).mockResolvedValue(POLICY);
    vi.mocked(listPolicyHistory).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    vi.mocked(updatePolicy).mockResolvedValue({ ...POLICY, bookingHorizonDays: 10, version: 5 });
    renderWithProviders(<PolicyPage />);

    const horizon = await screen.findByLabelText(/Booking horizon/);
    expect(screen.getByRole('button', { name: 'Save rules' })).toBeDisabled();

    fireEvent.change(horizon, { target: { value: '' } });
    expect(horizon).toHaveValue(null);
    expect(screen.getByRole('button', { name: 'Save 1 change' })).toBeDisabled();

    fireEvent.change(horizon, { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save 1 change' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Reason (recorded in the audit log)'), {
      target: { value: 'Longer horizon for exams' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save rules' }));

    await waitFor(() =>
      expect(updatePolicy).toHaveBeenCalledWith({
        bookingHorizonDays: 10,
        reason: 'Longer horizon for exams',
        version: 4,
      }),
    );
  });
});
