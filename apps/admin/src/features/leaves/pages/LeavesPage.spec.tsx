import { type AdminLeave, type AdminLeaveList } from '@ennel/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockAuth } from '@/test-utils/mock-auth';
import { renderWithProviders } from '@/test-utils/render';
import { approveLeave, listLeaves, rejectLeave } from '../api/leaves-api';
import { LeavesPage } from './LeavesPage';

let auth = mockAuth(['leaves:read', 'leaves:approve']);
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
const LIST: AdminLeaveList = {
  items: [PENDING],
  total: 1,
  page: 1,
  pageSize: 50,
  pendingCount: 1,
  requiresApproval: true,
};
const RESULT = { leave: PENDING, bookingsPaused: 0, bookingsResumed: 0 };

describe('LeavesPage (Admin §K)', () => {
  beforeEach(() => {
    auth = mockAuth(['leaves:read', 'leaves:approve']);
    vi.mocked(listLeaves).mockResolvedValue(LIST);
  });

  it('approves from the queue and rejects only with a reason', async () => {
    vi.mocked(approveLeave).mockResolvedValue({ ...RESULT, bookingsPaused: 4 });
    vi.mocked(rejectLeave).mockResolvedValue(RESULT);
    renderWithProviders(<LeavesPage />);

    expect(await screen.findByText('Approval queue (1)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(approveLeave).toHaveBeenCalledWith(PENDING.id, 1));

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject leave' }));
    expect(rejectLeave).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText('Reason (recorded in the audit log)'), {
      target: { value: 'Exams that week' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject leave' }));
    await waitFor(() => expect(rejectLeave).toHaveBeenCalledWith(PENDING.id, 1, 'Exams that week'));
  });

  it('hides adding leave from staff who cannot manage leaves', async () => {
    renderWithProviders(<LeavesPage />);

    expect(await screen.findByText('Approval queue (1)')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add leave for a student' }),
    ).not.toBeInTheDocument();
  });
});
