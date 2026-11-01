import { type AdminStudentDetail, type AdminStudentListItem } from '@ennel/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockAuth } from '@/test-utils/mock-auth';
import { renderWithProviders } from '@/test-utils/render';
import { getStudent, listHostels, listStudents } from '../api/students-api';
import { StudentsPage } from './StudentsPage';

const auth = mockAuth(['students:read', 'students:update', 'roster:import']);
vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => auth,
  usePermissions:
    () =>
    (...keys: string[]) =>
      keys.every((key) => auth.permissions.has(key as never)),
}));
vi.mock('../api/students-api', () => ({
  listStudents: vi.fn(),
  listHostels: vi.fn(),
  getStudent: vi.fn(),
  bulkUpdateHostel: vi.fn(),
}));

const UNREGISTERED: AdminStudentListItem = {
  rosterEntryId: '66666666-6666-4666-8666-666666666666',
  studentId: null,
  referenceNumber: '22CS001',
  fullName: 'Asha Rao',
  department: 'CSE',
  academicYear: 2,
  hostelBlockId: null,
  hostelName: null,
  blockName: null,
  roomNumber: null,
  isRegistered: false,
  isRosterActive: true,
  status: null,
  defaultBookingEnabled: null,
  mealDefaults: null,
  noShowCounts: null,
  isOnLeaveToday: false,
};
const REGISTERED: AdminStudentListItem = {
  ...UNREGISTERED,
  rosterEntryId: '77777777-7777-4777-8777-777777777777',
  studentId: '88888888-8888-4888-8888-888888888888',
  referenceNumber: '24900417',
  fullName: 'Ashwin Kumar',
  hostelName: 'Noyel',
  blockName: 'Block A',
  roomNumber: 'A605',
  isRegistered: true,
  status: 'ACTIVE',
  defaultBookingEnabled: true,
  mealDefaults: { BREAKFAST: 'OFF', LUNCH: 'AUTO_OFF', DINNER: 'ON' },
  noShowCounts: { BREAKFAST: 4, LUNCH: 5, DINNER: 0 },
  isOnLeaveToday: true,
};
const DETAIL: AdminStudentDetail = {
  ...REGISTERED,
  email: null,
  phone: null,
  parentPhone: null,
  registeredAt: null,
  onboardingCompletedAt: null,
  lockedUntil: null,
  preferences: [
    {
      mealType: 'DINNER',
      isEnabled: true,
      slotLabel: '7:30 PM - 8:00 PM',
      dietType: 'VEG',
      isAutoDisabled: false,
    },
  ],
  recentBookings: [
    {
      id: '99999999-9999-4999-8999-999999999999',
      mealDate: '2099-05-21',
      mealType: 'DINNER',
      slotLabel: '7:30 PM - 8:00 PM',
      status: 'BOOKED',
      source: 'DEFAULT',
    },
  ],
  leaves: [],
  noShowCounts: { BREAKFAST: 4, LUNCH: 5, DINNER: 0 },
  noShowWindowDays: 30,
  noShowDisableThreshold: 5,
  complaintsCount: 2,
  rosterVersion: 1,
};
const LIST = {
  items: [REGISTERED, UNREGISTERED],
  total: 2,
  page: 1,
  pageSize: 20,
  noShowWindowDays: 30,
  noShowWarningThreshold: 3,
  noShowDisableThreshold: 5,
};

beforeEach(() => {
  vi.mocked(listStudents).mockResolvedValue(LIST);
  vi.mocked(listHostels).mockResolvedValue([]);
  vi.mocked(getStudent).mockResolvedValue(DETAIL);
});

describe('StudentsPage (Admin §G, Figma "Admin — Students")', () => {
  it('shows Default Booking and No-show columns with words for screen readers', async () => {
    renderWithProviders(<StudentsPage />);
    expect(await screen.findByText('Ashwin Kumar')).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: 'Default Booking: Breakfast off, Lunch off after No-shows, Dinner on',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'No-shows: Breakfast 4, Lunch 5, Dinner 0' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('On leave').length).toBeGreaterThan(0);
    expect(within(screen.getByRole('table')).getByText('Not registered')).toBeInTheDocument();
  });

  it('opens the first student in the details panel with No-show meters', async () => {
    renderWithProviders(<StudentsPage />);
    expect(await screen.findByText('No-shows · last 30 days')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Lunch No-shows' })).toHaveAttribute(
      'aria-valuenow',
      '5',
    );
    expect(screen.getByText('Default Booking off for Lunch after No-shows')).toBeInTheDocument();
    expect(
      screen.getByText('Breakfast off · Lunch off (No-shows) · Dinner 7:30 PM'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Complaints' }));
    expect(screen.getByText(/2 identified complaint\(s\)/)).toBeInTheDocument();
  });

  it('filters by the No-show warning and leave chips', async () => {
    renderWithProviders(<StudentsPage />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'No-shows ≥ 3' }));
    await waitFor(() =>
      expect(listStudents).toHaveBeenLastCalledWith(
        expect.objectContaining({ atNoShowWarning: 'true', page: 1 }),
      ),
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'On leave' }));
    await waitFor(() =>
      expect(listStudents).toHaveBeenLastCalledWith(expect.objectContaining({ onLeave: 'true' })),
    );
  });

  it('clears the selection when a filter changes, so hidden students are never moved', async () => {
    renderWithProviders(<StudentsPage />);
    fireEvent.click(await screen.findByLabelText('Select Asha Rao'));
    expect(screen.getByRole('button', { name: /Move 1 to hostel/ })).toBeEnabled();
    expect(
      within(screen.getByText(/Showing 2 of 2 matching/)).getByText(/1 selected/, { exact: false }),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Search students'), { target: { value: 'zzz' } });
    expect(screen.getByRole('button', { name: /Move\s+to hostel/ })).toBeDisabled();
  });
});
