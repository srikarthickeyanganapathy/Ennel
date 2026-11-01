import { type AdminComplaint, type AdminComplaintDetail } from '@ennel/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockAuth } from '@/test-utils/mock-auth';
import { renderWithProviders } from '@/test-utils/render';
import {
  addComplaintNote,
  changeComplaintStatus,
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
  status: 'IN_REVIEW',
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
      authorName: 'Manager',
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
    byStatus: [{ status: 'NEW', count: 4 }],
    averageResolutionHours: 5.5,
  });
});

describe('ComplaintsPage (Admin §L)', () => {
  it('lists complaints with text statuses and shows the analytics', async () => {
    renderWithProviders(<ComplaintsPage />);
    expect(await screen.findByText('CMP-ABC234')).toBeInTheDocument();
    expect(screen.getAllByText('In review').length).toBeGreaterThan(0);
    expect(screen.getByText('Asha Rao (24900002)')).toBeInTheDocument();
    expect(await screen.findByText('5.5 hours')).toBeInTheDocument();
  });

  it('opens the detail with photos and notes, and resolves with a reply', async () => {
    vi.mocked(changeComplaintStatus).mockResolvedValue({ ...COMPLAINT, status: 'RESOLVED' });
    renderWithProviders(<ComplaintsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open CMP-ABC234' }));

    expect(await screen.findByAltText('Photo 1 of 1')).toHaveAttribute(
      'src',
      '/api/v1/files/x.jpg?sig=1',
    );
    expect(screen.getByText('Asked the kitchen.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save status' }));
    expect(await screen.findByText('Write a reply for the student')).toBeInTheDocument();
    expect(changeComplaintStatus).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Reply to the student'), {
      target: { value: 'We have spoken to the kitchen team.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save status' }));
    await waitFor(() =>
      expect(changeComplaintStatus).toHaveBeenCalledWith(COMPLAINT.id, {
        status: 'RESOLVED',
        response: 'We have spoken to the kitchen team.',
        version: 2,
      }),
    );
  });

  it('offers the next step again after a status change', async () => {
    vi.mocked(getComplaint)
      .mockResolvedValueOnce({ ...DETAIL, status: 'NEW', version: 1 })
      .mockResolvedValue({ ...DETAIL, status: 'IN_REVIEW', version: 2 });
    vi.mocked(changeComplaintStatus).mockResolvedValue({ ...COMPLAINT, status: 'IN_REVIEW' });
    renderWithProviders(<ComplaintsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open CMP-ABC234' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save status' }));
    await waitFor(() =>
      expect(changeComplaintStatus).toHaveBeenLastCalledWith(COMPLAINT.id, {
        status: 'IN_REVIEW',
        version: 1,
      }),
    );
    await screen.findByRole('option', { name: 'Rejected' });
    fireEvent.change(screen.getByLabelText('Reply to the student'), {
      target: { value: 'Fixed now.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save status' }));
    await waitFor(() =>
      expect(changeComplaintStatus).toHaveBeenLastCalledWith(COMPLAINT.id, {
        status: 'RESOLVED',
        response: 'Fixed now.',
        version: 2,
      }),
    );
  });

  it('adds an internal note', async () => {
    vi.mocked(addComplaintNote).mockResolvedValue({ id: 'n1' });
    renderWithProviders(<ComplaintsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open CMP-ABC234' }));
    fireEvent.change(await screen.findByLabelText('Add a note'), {
      target: { value: 'Warmer replaced.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    await waitFor(() =>
      expect(addComplaintNote).toHaveBeenCalledWith(COMPLAINT.id, 'Warmer replaced.'),
    );
  });

  it('says when the submitter is anonymous', async () => {
    vi.mocked(listComplaints).mockResolvedValue({
      items: [{ ...COMPLAINT, submitter: null, privacyMode: 'ANONYMOUS' }],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    renderWithProviders(<ComplaintsPage />);
    expect(await screen.findByText('Anonymous')).toBeInTheDocument();
  });
});
