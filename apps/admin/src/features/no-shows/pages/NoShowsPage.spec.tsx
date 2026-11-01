import { type AdminNoShowEvent, type AdminNoShowList } from '@ennel/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockAuth } from '@/test-utils/mock-auth';
import { renderWithProviders } from '@/test-utils/render';
import { approveAppeal, listNoShows, resetCount } from '../api/no-shows-api';
import { NoShowsPage } from './NoShowsPage';

const auth = mockAuth(['no-shows:read', 'no-shows:review-appeal', 'no-shows:reset']);
vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => auth,
  usePermissions:
    () =>
    (...keys: string[]) =>
      keys.every((key) => auth.permissions.has(key as never)),
}));
vi.mock('../api/no-shows-api', () => ({
  listNoShows: vi.fn(),
  approveAppeal: vi.fn(),
  rejectAppeal: vi.fn(),
  reviewHeld: vi.fn(),
  resetCount: vi.fn(),
  reEnableDefaultBooking: vi.fn(),
}));

const EVENT: AdminNoShowEvent = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  date: '2099-05-22',
  mealType: 'LUNCH',
  status: 'COUNTED',
  exclusionCause: null,
  excludedReason: null,
  excludedByName: null,
  student: {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    fullName: 'Asha Rao',
    referenceNumber: '24900002',
    blockName: 'Block A',
  },
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

describe('NoShowsPage (Admin §J)', () => {
  beforeEach(() => {
    vi.mocked(listNoShows).mockImplementation(async (query) =>
      query.status === 'HELD_FOR_REVIEW' ? { ...LIST, items: [] } : LIST,
    );
  });

  it('approves a report from the queue', async () => {
    vi.mocked(approveAppeal).mockResolvedValue({ changed: 1, count: 4, isAutoDisabled: false });
    renderWithProviders(<NoShowsPage />);

    expect(await screen.findByText('Reports to review (1)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(approveAppeal).toHaveBeenCalledWith(EVENT.appeal?.id));
  });

  it('resets a count only with a reason', async () => {
    vi.mocked(resetCount).mockResolvedValue({ changed: 5, count: 0, isAutoDisabled: true });
    renderWithProviders(<NoShowsPage />);

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
