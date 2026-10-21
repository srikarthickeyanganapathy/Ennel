import { type AdminSlot } from '@ennel/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { mockAuth } from '@/test-utils/mock-auth';
import { renderWithProviders } from '@/test-utils/render';
import { listOverrides, removeOverride } from '../api/mess-config-api';
import { CapacityDialog } from './CapacityDialog';

const auth = mockAuth(['mess-config:read', 'mess-config:update']);
vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => auth,
  usePermissions:
    () =>
    (...keys: string[]) =>
      keys.every((key) => auth.permissions.has(key as never)),
}));
vi.mock('../api/mess-config-api', () => ({
  getCapacityImpact: vi.fn(),
  listOverrides: vi.fn(),
  removeOverride: vi.fn(),
  setOverride: vi.fn(),
  setWeekdayCapacities: vi.fn(),
}));

const SLOT: AdminSlot = {
  id: '33333333-3333-4333-8333-333333333333',
  mealId: '44444444-4444-4444-8444-444444444444',
  label: '12:30 PM - 1:00 PM',
  startMinute: 750,
  endMinute: 780,
  sortOrder: 1,
  defaultCapacity: 120,
  isActive: true,
  version: 1,
  weekdayCapacities: [],
};

describe('CapacityDialog date overrides (Admin §D, working rule 7)', () => {
  it('asks for a reason before removing an override and sends that reason', async () => {
    vi.mocked(listOverrides).mockResolvedValue([
      {
        id: '55555555-5555-4555-8555-555555555555',
        slotId: SLOT.id,
        mealDate: '2026-10-30',
        capacity: 200,
        reason: 'Festival',
      },
    ]);
    vi.mocked(removeOverride).mockResolvedValue(undefined);
    renderWithProviders(<CapacityDialog slot={SLOT} open onOpenChange={() => undefined} />);

    fireEvent.click(await screen.findByRole('button', { name: /Remove override on/ }));
    expect(removeOverride).not.toHaveBeenCalled();

    const confirm = await screen.findByRole('dialog', { name: /Remove the override/ });
    fireEvent.change(within(confirm).getByLabelText('Reason (recorded in the audit log)'), {
      target: { value: 'Festival moved' },
    });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Remove override' }));

    await waitFor(() =>
      expect(removeOverride).toHaveBeenCalledWith(SLOT.id, '2026-10-30', 'Festival moved'),
    );
  });
});
