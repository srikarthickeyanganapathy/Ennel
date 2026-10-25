import { type AttendanceCounter, type AttendanceLookup } from '@ennel/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockAuth } from '@/test-utils/mock-auth';
import { renderWithProviders } from '@/test-utils/render';
import {
  getActiveWindow,
  getCounter,
  getOutage,
  lookupStudent,
  markPresent,
} from '../api/attendance-api';
import { AttendancePage } from './AttendancePage';

let auth = mockAuth(['attendance:read', 'attendance:mark']);
vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => auth,
  usePermissions:
    () =>
    (...keys: string[]) =>
      keys.every((key) => auth.permissions.has(key as never)),
}));
vi.mock('../api/attendance-api', () => ({
  getActiveWindow: vi.fn(),
  getCounter: vi.fn(),
  getOutage: vi.fn(),
  setOutage: vi.fn(),
  lookupStudent: vi.fn(),
  markPresent: vi.fn(),
  uploadAttendance: vi.fn(),
  confirmAttendanceImport: vi.fn(),
}));

const COUNTER: AttendanceCounter = {
  date: '2026-10-26',
  mealType: 'LUNCH',
  mealName: 'Lunch',
  opensAt: '2026-10-26T05:30:00.000Z',
  closesAt: '2026-10-26T08:00:00.000Z',
  phase: 'OPEN',
  isFinalised: false,
  outage: null,
  totals: { booked: 40, attended: 12, noShow: 0 },
  slots: [
    {
      slotId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      label: '12:00 PM - 12:30 PM',
      booked: 40,
      attended: 12,
    },
  ],
  recent: [],
};
const NO_BOOKING: AttendanceLookup = {
  student: {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    fullName: 'Asha Rao',
    referenceNumber: '24900002',
    blockName: 'Block A',
  },
  booking: null,
  attendance: null,
  canMark: true,
  note: 'No booking for this meal. Give a reason to record attendance anyway.',
  needsReason: true,
};

describe('AttendancePage (Admin §I)', () => {
  beforeEach(() => {
    auth = mockAuth(['attendance:read', 'attendance:mark']);
    vi.mocked(getActiveWindow).mockResolvedValue({ date: '2026-10-26', mealType: 'LUNCH' });
    vi.mocked(getCounter).mockResolvedValue(COUNTER);
    vi.mocked(getOutage).mockResolvedValue({ active: null });
  });

  it('shows live counts and asks for a reason before marking a student without a booking', async () => {
    vi.mocked(lookupStudent).mockResolvedValue(NO_BOOKING);
    vi.mocked(markPresent).mockResolvedValue({
      ...NO_BOOKING,
      canMark: false,
      needsReason: false,
      note: 'Attendance is already recorded.',
      attendance: {
        source: 'MANUAL_FALLBACK',
        recordedAt: '2026-10-26T06:00:00.000Z',
        verifiedAt: null,
      },
    });
    renderWithProviders(<AttendancePage />);

    expect(await screen.findByText('Lunch: 12 of 40 attended')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Reference number'), { target: { value: '24900002' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mark present' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Reason (recorded in the audit log)'), {
      target: { value: 'Guest pass' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mark present' }));
    await waitFor(() =>
      expect(markPresent).toHaveBeenCalledWith({
        date: '2026-10-26',
        mealType: 'LUNCH',
        referenceNumber: '24900002',
        reason: 'Guest pass',
      }),
    );
  });

  it('hides the outage toggle and import from counter staff', async () => {
    renderWithProviders(<AttendancePage />);

    expect(await screen.findByText(/Outage mode: OFF/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start outage mode' })).not.toBeInTheDocument();
    expect(screen.queryByText('Import attendance')).not.toBeInTheDocument();
  });
});
