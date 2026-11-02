import { type AdminLeave, type AdminLeaveList, type AdminLeaveListQuery } from '@ennel/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockAuth } from '@/test-utils/mock-auth';
import { renderWithProviders } from '@/test-utils/render';
import { approveLeave, getLeaveCalendar, listLeaves, rejectLeave } from '../api/leaves-api';
import { LeavesPage } from './LeavesPage';

let auth = mockAuth(['leaves:read', 'leaves:approve', 'policy:read']);
vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => auth,
  usePermissions:
    () =>
    (...keys: string[]) =>
      keys.every((key) => auth.permissions.has(key as never)),
}));
vi.mock('../api/leaves-api', () => ({
  listLeaves: vi.fn(),
  approveLeave: vi.fn(),
  rejectLeave: vi.fn(),
  createLeave: vi.fn(),
  endLeave: vi.fn(),
  correctLeave: vi.fn(),
  getLeaveCalendar: vi.fn(),
}));

const PENDING: AdminLeave = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  startDate: '2099-05-22',
  startMealType: 'BREAKFAST',
  endDate: '2099-05-24',
  endMealType: 'DINNER',
  reason: 'Family function',
  status: 'PENDING',
  state: 'PENDING',
  days: 3,
  meals: 9,
  rejectionReason: null,
  isCreatedByStaff: false,
  createdAt: '2099-05-01T05:00:00.000Z',
  decidedAt: null,
  version: 1,
  canChange: true,
  student: {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    fullName: 'Asha Rao',
    referenceNumber: '24900002',
    blockName: 'Block A',
  },
  decidedByName: null,
};
const SECOND: AdminLeave = {
  ...PENDING,
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  startDate: '2099-05-25',
  endDate: '2099-05-25',
  startMealType: 'DINNER',
  meals: 1,
  reason: null,
  version: 2,
  student: { ...PENDING.student, id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', fullName: 'Rahul V' },
};
const ON_LEAVE: AdminLeave = {
  ...PENDING,
  id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  status: 'APPROVED',
  state: 'ON_LEAVE',
};
const list = (items: AdminLeave[], total = items.length): AdminLeaveList => ({
  items,
  total,
  page: 1,
  pageSize: 20,
  pendingCount: 2,
  requiresApproval: true,
});
const RESULT = { leave: PENDING, bookingsPaused: 3, bookingsResumed: 0 };

describe('LeavesPage (Admin §K, Figma "Admin — Leave requests")', () => {
  beforeEach(() => {
    auth = mockAuth(['leaves:read', 'leaves:approve', 'policy:read']);
    vi.mocked(listLeaves).mockImplementation(async (query: AdminLeaveListQuery) => {
      if (query.state === 'PENDING') return list([PENDING, SECOND]);
      if (query.state === 'ON_LEAVE') return list([ON_LEAVE], 41);
      if (query.state === 'UPCOMING') return list([]);
      return list([PENDING, SECOND, ON_LEAVE]);
    });
    vi.mocked(getLeaveCalendar).mockResolvedValue({
      month: '2099-05',
      days: [
        { date: '2099-05-01', count: 0 },
        { date: '2099-05-02', count: 12 },
      ],
    });
  });

  it('opens on the approval queue with chip counts, the calendar and the approval rule', async () => {
    renderWithProviders(<LeavesPage />);
    expect(await screen.findByRole('radio', { name: 'Pending · 2' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: 'On leave · 41' })).toBeInTheDocument();
    expect(await screen.findByText('22 – 24 May')).toBeInTheDocument();
    expect(screen.getByText('Breakfast → Dinner')).toBeInTheDocument();
    expect(screen.getByText('25 May')).toBeInTheDocument();
    expect(
      await screen.findByRole('gridcell', { name: 'Sat 2 May: 12 students away' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Leave needs approval')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Change it in Settings & rules' })).toHaveAttribute(
      'href',
      '/policy',
    );
  });

  it('approves one request from its row and rejects only with a reason', async () => {
    vi.mocked(approveLeave).mockResolvedValue(RESULT);
    vi.mocked(rejectLeave).mockResolvedValue(RESULT);
    renderWithProviders(<LeavesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve leave for Asha Rao' }));
    await waitFor(() => expect(approveLeave).toHaveBeenCalledWith(PENDING.id, 1));

    fireEvent.click(screen.getByRole('button', { name: 'Reject leave for Rahul V' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject leave' }));
    expect(rejectLeave).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText('Reason (recorded in the audit log)'), {
      target: { value: 'Exams that week' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject leave' }));
    await waitFor(() => expect(rejectLeave).toHaveBeenCalledWith(SECOND.id, 2, 'Exams that week'));
  });

  it('approves the selected requests one by one after confirming', async () => {
    vi.mocked(approveLeave).mockResolvedValue(RESULT);
    renderWithProviders(<LeavesPage />);
    const bulk = await screen.findByRole('button', { name: 'Approve selected' });
    expect(bulk).toBeDisabled();
    fireEvent.click(await screen.findByLabelText('Select all requests on this page'));
    fireEvent.click(screen.getByRole('button', { name: 'Approve selected (2)' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Approve 2 leave request(s)?');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve 2' }));
    await waitFor(() => expect(approveLeave).toHaveBeenCalledTimes(2));
    expect(approveLeave).toHaveBeenCalledWith(SECOND.id, 2);
  });

  it('shows status badges outside the queue and hides adding leave without permission', async () => {
    renderWithProviders(<LeavesPage />);
    fireEvent.click(await screen.findByRole('radio', { name: 'All' }));
    expect(await screen.findAllByText('On leave')).not.toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Approve selected' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add leave for a student' }),
    ).not.toBeInTheDocument();
  });
});
