import { type Announcement } from '@ennel/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockAuth } from '@/test-utils/mock-auth';
import { renderWithProviders } from '@/test-utils/render';
import {
  createAnnouncement,
  listAnnouncements,
  previewAudience,
  scheduleAnnouncement,
  sendAnnouncement,
} from '../api/announcements-api';
import { istInputToIso } from '../components/announcement-labels';
import { AnnouncementsPage } from './AnnouncementsPage';

const auth = mockAuth(['announcements:read', 'announcements:manage']);
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
vi.mock('@/features/students/api/students-api', () => ({ listHostels: vi.fn(async () => []) }));

const DRAFT: Announcement = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  title: 'Dinner at 7:30 PM',
  body: 'Dinner starts later today.',
  category: 'TIMING',
  audience: { type: 'ALL', hostelIds: [], blockIds: [], academicYears: [], referenceNumbers: [] },
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

beforeEach(() => {
  vi.mocked(listAnnouncements).mockResolvedValue({
    items: [DRAFT, SENT],
    total: 2,
    page: 1,
    pageSize: 20,
  });
});

describe('AnnouncementsPage (Admin §M)', () => {
  it('shows the history with delivery counts and actions only for unsent ones', async () => {
    renderWithProviders(<AnnouncementsPage />);
    expect(await screen.findByText('Dinner at 7:30 PM')).toBeInTheDocument();
    expect(
      screen.getByText('120 in-app · 80 push sent · 40 push not delivered'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Send now' })).toHaveLength(1);
  });

  it('composes a custom-list draft and previews its recipients', async () => {
    vi.mocked(previewAudience).mockResolvedValue({
      recipients: 1,
      unknownReferenceNumbers: ['111'],
    });
    vi.mocked(createAnnouncement).mockResolvedValue(DRAFT);
    renderWithProviders(<AnnouncementsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'New announcement' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Water supply' } });
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'No water in Block A from 2 PM to 4 PM.' },
    });
    fireEvent.change(screen.getByLabelText('Audience'), { target: { value: 'CUSTOM' } });
    fireEvent.change(screen.getByLabelText('Reference numbers'), {
      target: { value: '24900002, 111' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Count recipients' }));
    expect(
      await screen.findByText(/1 student\(s\) will receive this. Not found: 111./),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() =>
      expect(createAnnouncement).toHaveBeenCalledWith({
        title: 'Water supply',
        body: 'No water in Block A from 2 PM to 4 PM.',
        category: 'GENERAL',
        audience: {
          type: 'CUSTOM',
          hostelIds: [],
          blockIds: [],
          academicYears: [],
          referenceNumbers: ['24900002', '111'],
        },
        channels: ['IN_APP', 'PUSH'],
      }),
    );
  });

  it('confirms before sending now', async () => {
    vi.mocked(sendAnnouncement).mockResolvedValue({ ...DRAFT, status: 'SENT' });
    renderWithProviders(<AnnouncementsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Send now' }));
    expect(await screen.findByText('Send this announcement now?')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: 'Send now' });
    fireEvent.click(buttons[buttons.length - 1] as HTMLElement);
    await waitFor(() => expect(sendAnnouncement).toHaveBeenCalledWith(DRAFT.id, 1));
  });

  it('schedules in IST', async () => {
    vi.mocked(scheduleAnnouncement).mockResolvedValue({ ...DRAFT, status: 'SCHEDULED' });
    renderWithProviders(<AnnouncementsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Schedule' }));
    fireEvent.change(await screen.findByLabelText('Send at (IST)'), {
      target: { value: '2099-05-23T18:30' },
    });
    const buttons = screen.getAllByRole('button', { name: 'Schedule' });
    fireEvent.click(buttons[buttons.length - 1] as HTMLElement);
    await waitFor(() =>
      expect(scheduleAnnouncement).toHaveBeenCalledWith(DRAFT.id, '2099-05-23T13:00:00.000Z', 1),
    );
    expect(istInputToIso('2099-05-23T00:15')).toBe('2099-05-22T18:45:00.000Z');
  });
});
