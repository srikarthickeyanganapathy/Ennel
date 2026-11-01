import { type Announcement, type AnnouncementListQuery } from '@ennel/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockAuth } from '@/test-utils/mock-auth';
import { renderWithProviders } from '@/test-utils/render';
import {
  createAnnouncement,
  listAnnouncements,
  previewAudience,
  scheduleAnnouncement,
  sendAnnouncement,
  updateAnnouncement,
} from '../api/announcements-api';
import { istInputToIso } from '../components/announcement-labels';
import { AnnouncementsPage } from './AnnouncementsPage';

let auth = mockAuth(['announcements:read', 'announcements:manage']);
vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => auth,
  usePermissions:
    () =>
    (...keys: string[]) =>
      keys.every((key) => auth.permissions.has(key as never)),
}));
vi.mock('../api/announcements-api', () => ({
  listAnnouncements: vi.fn(),
  createAnnouncement: vi.fn(),
  updateAnnouncement: vi.fn(),
  previewAudience: vi.fn(),
  sendAnnouncement: vi.fn(),
  cancelAnnouncement: vi.fn(),
  scheduleAnnouncement: vi.fn(),
}));
vi.mock('@/features/students/api/students-api', () => ({
  listHostels: vi.fn(async () => [
    {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      name: 'Noyel Hostel',
      isActive: true,
      blocks: [],
    },
  ]),
}));

const ALL = {
  type: 'ALL' as const,
  hostelIds: [],
  blockIds: [],
  academicYears: [],
  referenceNumbers: [],
};
const DRAFT: Announcement = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  title: 'Dinner at 7:30 PM',
  body: 'Dinner starts later today.',
  category: 'TIMING',
  audience: ALL,
  channels: ['IN_APP', 'PUSH'],
  status: 'DRAFT',
  scheduledFor: null,
  sentAt: null,
  createdByName: 'Manager',
  version: 1,
  createdAt: '2099-05-22T09:00:00.000Z',
  deliveries: { inApp: 0, pushSent: 0, pushFailed: 0 },
};
const SENT: Announcement = {
  ...DRAFT,
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  title: 'Menu change',
  status: 'SENT',
  sentAt: '2099-05-21T09:00:00.000Z',
  deliveries: { inApp: 120, pushSent: 80, pushFailed: 40 },
};
const SAVED: Announcement = {
  ...DRAFT,
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  title: 'Water supply',
  version: 1,
};

const page = (items: Announcement[]) => ({ items, total: items.length, page: 1, pageSize: 50 });

beforeEach(() => {
  auth = mockAuth(['announcements:read', 'announcements:manage']);
  vi.mocked(listAnnouncements).mockImplementation(async (query: AnnouncementListQuery) => {
    if (query.status === 'DRAFT') return page([DRAFT]);
    if (query.status === 'SENT') return page([SENT]);
    return page([]);
  });
  vi.mocked(previewAudience).mockResolvedValue({ recipients: 1180, unknownReferenceNumbers: [] });
  vi.mocked(createAnnouncement).mockResolvedValue(SAVED);
});

async function fillComposer() {
  fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'Water supply' } });
  fireEvent.change(screen.getByLabelText('Message'), {
    target: { value: 'No water in Block A from 2 PM to 4 PM.' },
  });
}

describe('AnnouncementsPage (Admin §M, Figma "Admin — Announcements")', () => {
  it('lists drafts with their actions and sent ones with delivery counts', async () => {
    renderWithProviders(<AnnouncementsPage />);
    expect(await screen.findByText('Dinner at 7:30 PM')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send now' })).toBeInTheDocument();
    expect(await screen.findByText('Menu change')).toBeInTheDocument();
    expect(screen.getByText('120 in the app')).toBeInTheDocument();
    expect(screen.getByText('80 push sent · 40 not delivered')).toBeInTheDocument();
  });

  it('shows how many students it reaches and keeps the lock screen neutral', async () => {
    renderWithProviders(<AnnouncementsPage />);
    await fillComposer();
    expect(await screen.findByText('Reaches 1,180 student(s)')).toBeInTheDocument();

    const lock = screen.getByLabelText('Lock screen preview');
    expect(lock).toHaveTextContent('You have a new notice');
    expect(lock).not.toHaveTextContent('Water supply');
    expect(screen.getByLabelText('In the app preview')).toHaveTextContent('Water supply');

    fireEvent.click(screen.getByRole('radio', { name: 'Urgent' }));
    expect(
      within(screen.getByLabelText('In the app preview')).getByText('Urgent'),
    ).toBeInTheDocument();
  });

  it('saves a draft for a custom list of students', async () => {
    renderWithProviders(<AnnouncementsPage />);
    await fillComposer();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Custom list' }));
    fireEvent.change(screen.getByLabelText('Reference numbers'), {
      target: { value: '24900002, 111' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() =>
      expect(createAnnouncement).toHaveBeenCalledWith({
        title: 'Water supply',
        body: 'No water in Block A from 2 PM to 4 PM.',
        category: 'GENERAL',
        audience: { ...ALL, type: 'CUSTOM', referenceNumbers: ['24900002', '111'] },
        channels: ['IN_APP', 'PUSH'],
      }),
    );
    expect(sendAnnouncement).not.toHaveBeenCalled();
  });

  it('targets a hostel from its chip', async () => {
    renderWithProviders(<AnnouncementsPage />);
    await fillComposer();
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Noyel Hostel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() =>
      expect(createAnnouncement).toHaveBeenCalledWith(
        expect.objectContaining({
          audience: { ...ALL, type: 'HOSTEL', hostelIds: ['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'] },
        }),
      ),
    );
  });

  it('confirms before publishing, then saves and sends', async () => {
    vi.mocked(sendAnnouncement).mockResolvedValue({ ...SAVED, status: 'SENT' });
    renderWithProviders(<AnnouncementsPage />);
    await fillComposer();
    await screen.findByText('Reaches 1,180 student(s)');
    fireEvent.click(screen.getByRole('button', { name: 'Publish now' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('goes to 1180 student(s)');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send now' }));
    await waitFor(() => expect(sendAnnouncement).toHaveBeenCalledWith(SAVED.id, 1));
    expect(createAnnouncement).toHaveBeenCalledTimes(1);
  });

  it('schedules in IST from the composer', async () => {
    vi.mocked(scheduleAnnouncement).mockResolvedValue({ ...SAVED, status: 'SCHEDULED' });
    renderWithProviders(<AnnouncementsPage />);
    await fillComposer();
    fireEvent.click(screen.getByRole('radio', { name: 'Schedule' }));
    fireEvent.change(screen.getByLabelText('Send at (IST)'), {
      target: { value: '2099-05-23T18:30' },
    });
    // The composer comes first; the draft below has its own "Schedule" button.
    fireEvent.click(screen.getAllByRole('button', { name: 'Schedule' })[0] as HTMLElement);
    await waitFor(() =>
      expect(scheduleAnnouncement).toHaveBeenCalledWith(SAVED.id, '2099-05-23T13:00:00.000Z', 1),
    );
    expect(istInputToIso('2099-05-23T00:15')).toBe('2099-05-22T18:45:00.000Z');
  });

  it('edits a draft from the list', async () => {
    vi.mocked(updateAnnouncement).mockResolvedValue({ ...DRAFT, version: 2 });
    renderWithProviders(<AnnouncementsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(await screen.findByLabelText('Title')).toHaveValue('Dinner at 7:30 PM');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(updateAnnouncement).toHaveBeenCalledWith(
        DRAFT.id,
        expect.objectContaining({ title: 'Dinner at 7:30 PM', category: 'TIMING', version: 1 }),
      ),
    );
  });

  it('confirms before sending a saved draft', async () => {
    vi.mocked(sendAnnouncement).mockResolvedValue({ ...DRAFT, status: 'SENT' });
    renderWithProviders(<AnnouncementsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Send now' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send now' }));
    await waitFor(() => expect(sendAnnouncement).toHaveBeenCalledWith(DRAFT.id, 1));
  });

  it('shows the history only to staff who may read but not send', async () => {
    auth = mockAuth(['announcements:read']);
    renderWithProviders(<AnnouncementsPage />);
    expect(await screen.findByText('Menu change')).toBeInTheDocument();
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send now' })).not.toBeInTheDocument();
  });
});
