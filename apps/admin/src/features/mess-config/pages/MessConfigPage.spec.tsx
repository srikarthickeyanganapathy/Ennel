import {
  type AdminMeal,
  type MessPolicyView,
  type SlotAvailability,
  type SlotAvailabilityResponse,
} from '@ennel/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockAuth } from '@/test-utils/mock-auth';
import { renderWithProviders } from '@/test-utils/render';
import {
  getCapacityImpact,
  getPolicy,
  getSlotAvailability,
  getThresholds,
  listMeals,
  updatePolicy,
  updateSlot,
} from '../api/mess-config-api';
import { MessConfigPage } from './MessConfigPage';

const MANAGER = ['mess-config:read', 'mess-config:update', 'policy:read', 'policy:update'];
let auth = mockAuth(MANAGER as never);
vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => auth,
  usePermissions:
    () =>
    (...keys: string[]) =>
      keys.every((key) => auth.permissions.has(key as never)),
}));
vi.mock('../api/mess-config-api', () => ({
  listMeals: vi.fn(),
  getSlotAvailability: vi.fn(),
  getPolicy: vi.fn(),
  getThresholds: vi.fn(),
  getCapacityImpact: vi.fn(),
  updateSlot: vi.fn(),
  updatePolicy: vi.fn(),
  updateMeal: vi.fn(),
  updateThresholds: vi.fn(),
  listOverrides: vi.fn(),
}));

const SLOT = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  mealId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  label: '12:30 PM - 1:00 PM',
  startMinute: 750,
  endMinute: 780,
  sortOrder: 1,
  defaultCapacity: 500,
  isActive: true,
  version: 3,
  weekdayCapacities: [],
};
const MEAL = (mealType: AdminMeal['mealType'], displayName: string): AdminMeal => ({
  id: `cccccccc-cccc-4ccc-8ccc-${mealType === 'LUNCH' ? 'aaaaaaaaaaaa' : 'bbbbbbbbbbbb'}`,
  mealType,
  displayName,
  serviceStartMinute: 700,
  serviceEndMinute: 900,
  attendanceGraceMinutes: 0,
  isActive: true,
  version: 1,
  slots: [SLOT],
});
const LIVE: SlotAvailability = {
  slotId: SLOT.id,
  label: SLOT.label,
  startMinute: 750,
  endMinute: 780,
  officialCapacity: 500,
  bookedCount: 450,
  overCapacityCount: 0,
  occupancyPct: 90,
  status: 'FILLING_FAST',
  isRecommended: false,
  canSelect: true,
  unavailableReason: null,
};
const POLICY = {
  allowOverCapacityBooking: false,
  cancellationCutoffMinutes: 60,
  version: 7,
} as MessPolicyView;

describe('MessConfigPage (Admin §D, Figma "Admin — Slots & capacity")', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth = mockAuth(MANAGER as never);
    vi.mocked(listMeals).mockResolvedValue([MEAL('LUNCH', 'Lunch'), MEAL('DINNER', 'Dinner')]);
    vi.mocked(getSlotAvailability).mockResolvedValue({
      slots: [LIVE],
      isClosed: false,
      closureTitle: null,
    } as SlotAvailabilityResponse);
    vi.mocked(getPolicy).mockResolvedValue(POLICY);
    vi.mocked(getThresholds).mockResolvedValue({
      fillingFastThresholdPct: 85,
      recommendedMaxOccupancyPct: 60,
      version: 7,
    });
    vi.mocked(updateSlot).mockResolvedValue(SLOT);
  });

  it('shows live occupancy with its label, and the rules from the values in force', async () => {
    renderWithProviders(<MessConfigPage />);
    const row = await screen.findByRole('row', { name: /12:30 PM - 1:00 PM/ });
    expect(await within(row).findByText('450 / 500')).toBeInTheDocument();
    expect(within(row).getByText('90%')).toBeInTheDocument();
    expect(within(row).getByText('Filling fast')).toBeInTheDocument();
    expect(await screen.findByText('50 seats left')).toBeInTheDocument();
    expect(
      await screen.findByText('Students can cancel until 1 hour before their slot.'),
    ).toBeInTheDocument();
    expect(screen.getByText('“Filling fast” shows at 85% booked.')).toBeInTheDocument();
  });

  it('saves a raised capacity from the row with the slot version, and can discard it', async () => {
    renderWithProviders(<MessConfigPage />);
    const input = await screen.findByLabelText('Capacity for 12:30 PM - 1:00 PM');
    fireEvent.change(input, { target: { value: '520' } });
    expect(screen.getByText(/1 unsaved change · 12:30 PM - 1:00 PM 500 → 520/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(input).toHaveValue(500);
    expect(screen.queryByText(/unsaved change/)).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: '520' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(updateSlot).toHaveBeenCalledWith(SLOT.id, {
        startMinute: 750,
        endMinute: 780,
        defaultCapacity: 520,
        version: 3,
      }),
    );
    expect(getCapacityImpact).not.toHaveBeenCalled();
  });

  it('warns with impact counts before lowering capacity below bookings', async () => {
    vi.mocked(getCapacityImpact).mockResolvedValue({
      affectedDates: [{ mealDate: '2099-05-22', bookedCount: 450, overBy: 50 }],
      totalOverBy: 50,
    });
    renderWithProviders(<MessConfigPage />);
    fireEvent.change(await screen.findByLabelText('Capacity for 12:30 PM - 1:00 PM'), {
      target: { value: '400' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('50 over on 1 date');
    expect(updateSlot).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lower capacity' }));
    await waitFor(() => expect(updateSlot).toHaveBeenCalledTimes(1));
  });

  it('does not carry unsaved capacities over to another meal', async () => {
    renderWithProviders(<MessConfigPage />);
    fireEvent.change(await screen.findByLabelText('Capacity for 12:30 PM - 1:00 PM'), {
      target: { value: '520' },
    });
    fireEvent.click(screen.getByRole('radio', { name: 'Dinner' }));
    expect(await screen.findByLabelText('Capacity for 12:30 PM - 1:00 PM')).toHaveValue(500);
    expect(screen.queryByText(/unsaved change/)).not.toBeInTheDocument();
  });

  it('changes the over-capacity policy only with a reason', async () => {
    vi.mocked(updatePolicy).mockResolvedValue({ ...POLICY, allowOverCapacityBooking: true });
    renderWithProviders(<MessConfigPage />);
    fireEvent.click(await screen.findByRole('switch', { name: 'Allow bookings above capacity' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(updatePolicy).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText('Reason (recorded in the audit log)'), {
      target: { value: 'Approved by the college' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(updatePolicy).toHaveBeenCalledWith({
        allowOverCapacityBooking: true,
        reason: 'Approved by the college',
        version: 7,
      }),
    );
  });

  it('is read-only for staff who can only view it', async () => {
    auth = mockAuth(['mess-config:read'] as never);
    renderWithProviders(<MessConfigPage />);
    await screen.findByRole('row', { name: /12:30 PM - 1:00 PM/ });
    expect(screen.queryByLabelText('Capacity for 12:30 PM - 1:00 PM')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add slot' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(getPolicy).not.toHaveBeenCalled();
  });
});
