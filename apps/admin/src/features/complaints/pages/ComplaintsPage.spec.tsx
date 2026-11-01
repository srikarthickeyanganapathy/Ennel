import { type AdminComplaint, type AdminComplaintDetail } from '@ennel/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockAuth } from '@/test-utils/mock-auth';
import { renderWithProviders } from '@/test-utils/render';
import {
  addComplaintNote,
  changeComplaintStatus,
  closeWithReply,
  getComplaint,
  getComplaintAnalytics,
  listAssignees,
  listComplaints,
} from '../api/complaints-api';
import { ComplaintsPage } from './ComplaintsPage';

const auth = mockAuth(['complaints:read', 'complaints:resolve', 'complaints:note']);
vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => auth,
  usePermissions:
    () =>
    (...keys: string[]) =>
      keys.every((key) => auth.permissions.has(key as never)),
}));
vi.mock('../api/complaints-api', () => ({
  listComplaints: vi.fn(),
  getComplaint: vi.fn(),
  changeComplaintStatus: vi.fn(),
  closeWithReply: vi.fn(),
  assignComplaint: vi.fn(),
  addComplaintNote: vi.fn(),
  listAssignees: vi.fn(),
  getComplaintAnalytics: vi.fn(),
}));
vi.mock('@/features/students/api/students-api', () => ({ listHostels: vi.fn(async () => []) }));

const COMPLAINT: AdminComplaint = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  referenceCode: 'CMP-ABC234',
  type: 'COMPLAINT',
  category: 'FOREIGN_OBJECT',
  mealType: 'LUNCH',
  mealDate: '2099-05-22',
  description: 'There was a stone in the rice.',
  status: 'NEW',
  response: null,
  privacyMode: 'PRIVATE_IDENTIFIED',
  submitter: {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    fullName: 'Asha Rao',
    referenceNumber: '24900002',
    blockName: 'Block A',
  },
  assignedTo: null,
  photoCount: 1,
  version: 2,
  createdAt: '2099-05-22T09:00:00.000Z',
  resolvedAt: null,
};
const DETAIL: AdminComplaintDetail = {
  ...COMPLAINT,
  photos: [{ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', url: '/api/v1/files/x.jpg?sig=1' }],
  notes: [
    {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      body: 'Asked the kitchen.',
      authorName: 'Kitchen Supervisor',
      createdAt: '2099-05-22T10:00:00.000Z',
    },
  ],
  history: [{ fromStatus: null, toStatus: 'NEW', actorName: null, createdAt: COMPLAINT.createdAt }],
};

beforeEach(() => {
  vi.mocked(listComplaints).mockResolvedValue({
    items: [COMPLAINT],
    total: 1,
    page: 1,
    pageSize: 20,
  });
  vi.mocked(getComplaint).mockResolvedValue(DETAIL);
  vi.mocked(listAssignees).mockResolvedValue([]);
  vi.mocked(getComplaintAnalytics).mockResolvedValue({
    total: 4,
    byCategory: [{ category: 'FOOD_QUALITY', count: 3 }],
    byMeal: [{ mealType: 'LUNCH', count: 4 }],
    byStatus: [
      { status: 'NEW', count: 2 },
      { status: 'RESOLVED', count: 2 },
    ],
    averageResolutionHours: 5.5,
  });
});

describe('ComplaintsPage (Admin §L, Figma "Admin — Complaints")', () => {
  it('shows the KPI row, status chips with counts, and opens the first report beside the list', async () => {
    renderWithProviders(<ComplaintsPage />);

    expect(await screen.findByText('Top: Food quality (3)')).toBeInTheDocument();
    expect(screen.getByText('5.5 h')).toBeInTheDocument();
    expect(screen.getByText('Most about Lunch (4)')).toBeInTheDocument();
    expect(await screen.findByRole('radio', { name: 'New · 1' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(listComplaints).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'NEW', page: 1 }),
    );

    expect(
      await screen.findByRole('button', { name: 'CMP-ABC234: Foreign object, New' }),
    ).toHaveAttribute('aria-current', 'true');
    expect(await screen.findByText('From Asha Rao · 24900002 · Block A')).toBeInTheDocument();
    expect(screen.getByAltText('Photo 1 of 1')).toHaveAttribute('src', '/api/v1/files/x.jpg?sig=1');
    expect(screen.getByText('Asked the kitchen.')).toBeInTheDocument();
    expect(screen.getByText('KS')).toBeInTheDocument();
  });

  it('filters by status when a chip is chosen', async () => {
    renderWithProviders(<ComplaintsPage />);
    fireEvent.click(await screen.findByRole('radio', { name: /^Resolved/ }));
    await waitFor(() =>
      expect(listComplaints).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'RESOLVED', pageSize: 20 }),
      ),
    );
  });

  it('starts the review from the status chips', async () => {
    vi.mocked(changeComplaintStatus).mockResolvedValue({ ...COMPLAINT, status: 'IN_REVIEW' });
    renderWithProviders(<ComplaintsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'In review' }));
    await waitFor(() =>
      expect(changeComplaintStatus).toHaveBeenCalledWith(COMPLAINT.id, {
        status: 'IN_REVIEW',
        version: 2,
      }),
    );
  });

  it('needs a reply before resolving, then sends it', async () => {
    vi.mocked(closeWithReply).mockResolvedValue({ ...COMPLAINT, status: 'RESOLVED' });
    renderWithProviders(<ComplaintsPage />);
    const resolve = await screen.findByRole('button', { name: 'Reply & resolve' });
    expect(resolve).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Reply to student'), {
      target: { value: 'We have spoken to the kitchen team.' },
    });
    expect(screen.getByText('35 / 2000')).toBeInTheDocument();
    fireEvent.click(resolve);
    await waitFor(() =>
      expect(closeWithReply).toHaveBeenCalledWith(
        expect.objectContaining({ id: COMPLAINT.id, status: 'NEW', version: 2 }),
        'RESOLVED',
        'We have spoken to the kitchen team.',
      ),
    );
  });

  it('adds an internal note', async () => {
    vi.mocked(addComplaintNote).mockResolvedValue({ id: 'n1' });
    renderWithProviders(<ComplaintsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add internal note' }));
    fireEvent.change(screen.getByLabelText('New internal note'), {
      target: { value: 'Warmer replaced.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
    await waitFor(() =>
      expect(addComplaintNote).toHaveBeenCalledWith(COMPLAINT.id, 'Warmer replaced.'),
    );
  });

  it('shows a closed report with its reply and no reply box', async () => {
    vi.mocked(getComplaint).mockResolvedValue({
      ...DETAIL,
      status: 'RESOLVED',
      response: 'The warmer is fixed.',
    });
    renderWithProviders(<ComplaintsPage />);
    expect(await screen.findByText('Reply sent to the student')).toBeInTheDocument();
    expect(screen.getByText('The warmer is fixed.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Reply to student')).not.toBeInTheDocument();
  });

  it('says when the student identity is hidden', async () => {
    vi.mocked(getComplaint).mockResolvedValue({
      ...DETAIL,
      submitter: null,
      privacyMode: 'ANONYMOUS',
    });
    renderWithProviders(<ComplaintsPage />);
    expect(await screen.findByText('Student identity hidden')).toBeInTheDocument();
    expect(screen.getByText('Sent anonymously')).toBeInTheDocument();
  });
});
