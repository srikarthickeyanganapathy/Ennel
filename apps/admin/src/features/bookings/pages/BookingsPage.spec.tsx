import { type AdminBooking } from '@ennel/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { mockAuth } from '@/test-utils/mock-auth';
import { renderWithProviders } from '@/test-utils/render';
import { listHostels, listMeals } from '@/features/mess-config/api/mess-config-api';
import { cancelBooking, listBookings } from '../api/bookings-api';
import { BookingsPage } from './BookingsPage';

let auth = mockAuth(['bookings:read', 'bookings:override', 'bookings:bulk']);
vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => auth,
  usePermissions:
    () =>
    (...keys: string[]) =>
      keys.every((key) => auth.permissions.has(key as never)),
}));
vi.mock('../api/bookings-api', () => ({
  listBookings: vi.fn(),
  cancelBooking: vi.fn(),
  moveBooking: vi.fn(),
  correctBookingStatus: vi.fn(),
  createBooking: vi.fn(),
  previewBulkBookings: vi.fn(),
  applyBulkBookings: vi.fn(),
}));
vi.mock('@/features/mess-config/api/mess-config-api', () => ({
  listMeals: vi.fn(),
  listHostels: vi.fn(),
}));

const BOOKING: AdminBooking = {
  id: '22222222-2222-4222-8222-222222222222',
  studentId: '33333333-3333-4333-8333-333333333333',
  studentName: 'Asha Rao',
  referenceNumber: '24900001',
  hostelName: 'North',
  blockName: 'Block A',
  date: '2026-10-25',
  mealType: 'LUNCH',
  slotId: '44444444-4444-4444-8444-444444444444',
  slotLabel: '11:00 AM - 11:30 AM',
  dietType: 'VEG',
  status: 'BOOKED',
  source: 'DEFAULT',
  isOverCapacity: false,
  isUpdatedByStaff: true,
  lastOverrideReason: 'Phone died',
  updatedAt: '2026-10-24T05:00:00.000Z',
  version: 3,
};

function setup() {
  vi.mocked(listBookings).mockResolvedValue({ items: [BOOKING], total: 1, page: 1, pageSize: 20 });
  vi.mocked(listMeals).mockResolvedValue([]);
  vi.mocked(listHostels).mockResolvedValue([]);
}

describe('BookingsPage (Admin §H)', () => {
  it('shows each booking with text statuses, the staff flag and the source', async () => {
    setup();
    renderWithProviders(<BookingsPage />);
    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
    const grid = within(screen.getByRole('table', { name: 'Bookings' }));
    expect(grid.getByText('Booked')).toBeInTheDocument();
    expect(grid.getByText('Updated by staff')).toBeInTheDocument();
    expect(grid.getByText('Default Booking')).toBeInTheDocument();
  });

  it('cancels only with a reason, sending the version the grid showed', async () => {
    setup();
    vi.mocked(cancelBooking).mockResolvedValue({ ...BOOKING, status: 'CANCELLED', version: 4 });
    renderWithProviders(<BookingsPage />);
    fireEvent.pointerDown(await screen.findByRole('button', { name: 'Actions for Asha Rao' }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Cancel booking' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel booking' }));
    expect(cancelBooking).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Reason (recorded in the audit log)'), {
      target: { value: 'Went home' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await waitFor(() =>
      expect(cancelBooking).toHaveBeenCalledWith(BOOKING.id, { reason: 'Went home', version: 3 }),
    );
  });

  it('hides override controls from roles that can only read', async () => {
    auth = mockAuth(['bookings:read']);
    setup();
    renderWithProviders(<BookingsPage />);
    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actions for Asha Rao' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /selected/ })).not.toBeInTheDocument();
    auth = mockAuth(['bookings:read', 'bookings:override', 'bookings:bulk']);
  });
});
