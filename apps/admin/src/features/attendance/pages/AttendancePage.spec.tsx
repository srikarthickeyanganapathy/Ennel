import {
  type AdminNoShowEvent,
  type AdminNoShowList,
  type AttendanceCounter,
  type AttendanceLookup,
  type NoShowAtRisk,
} from '@ennel/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  approveAppeal,
  getAtRisk,
  listNoShows,
  rejectAppeal,
  resetCount,
} from '@/features/no-shows/api/no-shows-api';
import { mockAuth } from '@/test-utils/mock-auth';
import { renderWithProviders } from '@/test-utils/render';
import {
  getActiveWindow,
  getCounter,
  getOutage,
  lookupStudent,
  markPresent,
  setOutage,
} from '../api/attendance-api';
import { AttendancePage } from './AttendancePage';

const COUNTER_ROLE = ['attendance:read', 'attendance:mark'];
const MANAGER_ROLE = [
  ...COUNTER_ROLE,
  'attendance:outage-toggle',
  'no-shows:read',
  'no-shows:review-appeal',
  'no-shows:reset',
];
let auth = mockAuth(COUNTER_ROLE as never);
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
vi.mock('@/features/no-shows/api/no-shows-api', () => ({
  getAtRisk: vi.fn(),
  listNoShows: vi.fn(),
  approveAppeal: vi.fn(),
  rejectAppeal: vi.fn(),
  reviewHeld: vi.fn(),
  resetCount: vi.fn(),
  reEnableDefaultBooking: vi.fn(),
}));

const SLOT = { booked: 40, attended: 12, noShow: 0, hasStarted: true };
const COUNTER: AttendanceCounter = {
  date: '2026-10-26',
  mealType: 'LUNCH',
  mealName: 'Lunch',
  opensAt: '2026-10-26T05:30:00.000Z',
  closesAt: '2026-10-26T08:00:00.000Z',
  phase: 'OPEN',
  isFinalised: false,
  outage: null,
  totals: { booked: 60, attended: 12, noShow: 0 },
  slots: [
    { ...SLOT, slotId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', label: '12:00 PM - 12:30 PM' },
    {
      slotId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      label: '1:00 PM - 1:30 PM',
      booked: 20,
      attended: 0,
      noShow: 0,
      hasStarted: false,
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
const EVENT: AdminNoShowEvent = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  date: '2099-05-22',
  mealType: 'LUNCH',
  status: 'COUNTED',
  exclusionCause: null,
  excludedReason: null,
  excludedByName: null,
  student: NO_BOOKING.student,
  currentCount: 5,
  isAutoDisabled: true,
  appeal: {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    status: 'PENDING',
    message: 'The camera did not see me.',
    decisionReason: null,
    createdAt: '2099-05-22T09:00:00.000Z',
    decidedAt: null,
  },
  createdAt: '2099-05-22T09:00:00.000Z',
};
const LIST: AdminNoShowList = {
  items: [EVENT],
  total: 1,
  page: 1,
  pageSize: 20,
  pendingAppeals: 1,
  heldForReview: 0,
};
const AT_RISK: NoShowAtRisk = {
  windowDays: 30,
  warningThreshold: 3,
  disableThreshold: 5,
  total: 1,
  items: [{ student: NO_BOOKING.student, mealType: 'DINNER', count: 4 }],
};

describe('AttendancePage (Admin §I, §J, Figma "Admin — Attendance & No-shows")', () => {
  beforeEach(() => {
    auth = mockAuth(COUNTER_ROLE as never);
    window.history.replaceState({}, '', '/');
    vi.mocked(getActiveWindow).mockResolvedValue({ date: '2026-10-26', mealType: 'LUNCH' });
    vi.mocked(getCounter).mockResolvedValue(COUNTER);
    vi.mocked(getOutage).mockResolvedValue({ active: null });
    vi.mocked(getAtRisk).mockResolvedValue(AT_RISK);
    vi.mocked(listNoShows).mockImplementation(async (query) =>
      query.status === 'HELD_FOR_REVIEW' ? { ...LIST, items: [] } : LIST,
    );
  });

  it('shows slot counts, with pending worked out and unstarted slots labelled', async () => {
    renderWithProviders(<AttendancePage />);
    expect(await screen.findByText(/12 of 60 attended/)).toBeInTheDocument();
    const row = screen.getByRole('row', { name: /12:00 PM - 12:30 PM/ });
    expect(within(row).getByText('28')).toBeInTheDocument();
    expect(within(row).getByText('30%')).toBeInTheDocument();
    expect(within(row).getByText('—')).toBeInTheDocument();
    const later = screen.getByRole('row', { name: /1:00 PM - 1:30 PM/ });
    expect(within(later).getByText('Not started')).toBeInTheDocument();
  });

  it('asks for a reason before marking a student without a booking', async () => {
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
    fireEvent.change(await screen.findByLabelText('Reference number'), {
      target: { value: '24900002' },
    });
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

  it('gives counter staff the counter only', async () => {
    renderWithProviders(<AttendancePage />);
    expect(await screen.findByText(/12 of 60 attended/)).toBeInTheDocument();
    expect(screen.getByText('Off')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByText('Import attendance')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Appeals/ })).not.toBeInTheDocument();
    expect(screen.queryByText('No-show appeals')).not.toBeInTheDocument();
    expect(listNoShows).not.toHaveBeenCalled();
    expect(getAtRisk).not.toHaveBeenCalled();
  });

  it('starts outage mode from the switch only with a reason', async () => {
    auth = mockAuth(MANAGER_ROLE as never);
    vi.mocked(setOutage).mockResolvedValue({ active: null });
    renderWithProviders(<AttendancePage />);
    fireEvent.click(await screen.findByRole('switch', { name: 'Attendance outage' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start outage mode' }));
    expect(setOutage).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText('Reason (recorded in the audit log)'), {
      target: { value: 'Scanner offline' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start outage mode' }));
    await waitFor(() => expect(setOutage).toHaveBeenCalledWith(true, 'Scanner offline'));
  });

  it('lists students at risk against the policy thresholds', async () => {
    auth = mockAuth(MANAGER_ROLE as never);
    renderWithProviders(<AttendancePage />);
    expect(await screen.findByText('At risk · 3–4 No-shows')).toBeInTheDocument();
    expect(screen.getByText('4/5')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'No-shows · 30 days' })).toBeInTheDocument();
    expect(await screen.findByRole('radio', { name: 'Appeals · 1' })).toBeInTheDocument();
  });

  it('approves an appeal with the note typed on its card', async () => {
    auth = mockAuth(MANAGER_ROLE as never);
    vi.mocked(approveAppeal).mockResolvedValue({ changed: 1, count: 4, isAutoDisabled: false });
    renderWithProviders(<AttendancePage />);
    fireEvent.change(await screen.findByLabelText('Note for Asha Rao'), {
      target: { value: 'Scanner log checked' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Approve report from Asha Rao/ }));
    await waitFor(() =>
      expect(approveAppeal).toHaveBeenCalledWith(EVENT.appeal?.id, 'Scanner log checked'),
    );
  });

  it('rejects an appeal through a dialog that starts with the typed note', async () => {
    auth = mockAuth(MANAGER_ROLE as never);
    vi.mocked(rejectAppeal).mockResolvedValue({ changed: 0, count: 5, isAutoDisabled: true });
    renderWithProviders(<AttendancePage />);
    fireEvent.change(await screen.findByLabelText('Note for Asha Rao'), {
      target: { value: 'No scanner fault that day' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reject report from Asha Rao' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Reason (recorded in the audit log)')).toHaveValue(
      'No scanner fault that day',
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject report' }));
    await waitFor(() =>
      expect(rejectAppeal).toHaveBeenCalledWith(EVENT.appeal?.id, 'No scanner fault that day'),
    );
  });

  it('opens the No-shows tab on the rolling window and resets a count only with a reason', async () => {
    auth = mockAuth(MANAGER_ROLE as never);
    vi.mocked(resetCount).mockResolvedValue({ changed: 5, count: 0, isAutoDisabled: true });
    renderWithProviders(<AttendancePage />);
    fireEvent.click(await screen.findByRole('radio', { name: 'No-shows · 30 days' }));
    await waitFor(() =>
      expect(listNoShows).toHaveBeenCalledWith(
        expect.objectContaining({ from: expect.any(String) }),
      ),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Reset count' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset count' }));
    expect(resetCount).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText('Reason (recorded in the audit log)'), {
      target: { value: 'Medical note from the warden' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset count' }));
    await waitFor(() =>
      expect(resetCount).toHaveBeenCalledWith(
        EVENT.student.id,
        'LUNCH',
        'Medical note from the warden',
      ),
    );
  });
});
