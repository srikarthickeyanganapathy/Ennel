import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { type NotificationList, type StudentNotification } from '@ennel/shared';
import { mockRouter, renderWithProviders } from '@/test-utils/render';
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notifications-api';
import { NotificationBell } from '../components/NotificationBell';
import { NotificationsScreen } from './NotificationsScreen';

jest.mock('../api/notifications-api');

const notice = (overrides: Partial<StudentNotification>): StudentNotification => ({
  id: '11111111-1111-4111-8111-111111111111',
  category: 'LEAVE',
  title: 'Leave approved',
  body: 'Your leave from 3 Nov breakfast to 5 Nov dinner was approved.',
  relatedEntityType: 'leave',
  relatedEntityId: '22222222-2222-4222-8222-222222222222',
  readAt: null,
  createdAt: '2026-11-01T04:30:00.000Z',
  ...overrides,
});
const page = (items: StudentNotification[], unreadCount: number): NotificationList => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 20,
  unreadCount,
});

describe('NotificationBell (Spec §13)', () => {
  it('shows the unread count and opens Notifications', async () => {
    jest.mocked(getUnreadCount).mockResolvedValue(3);
    await renderWithProviders(<NotificationBell />);
    const bell = await screen.findByLabelText('Notifications, 3 unread');
    expect(screen.getByText('3')).toBeTruthy();
    await fireEvent.press(bell);
    expect(mockRouter.push).toHaveBeenCalledWith('/(student)/notifications');
  });
});

describe('NotificationsScreen (Spec §13)', () => {
  it('opens a row, marks it read and offers the related screen', async () => {
    jest.mocked(getUnreadCount).mockResolvedValue(1);
    jest.mocked(listNotifications).mockResolvedValue(page([notice({})], 1));
    jest.mocked(markNotificationRead).mockResolvedValue(0);
    await renderWithProviders(<NotificationsScreen />);

    await fireEvent.press(await screen.findByLabelText('Unread. Leave approved'));
    await waitFor(() =>
      expect(markNotificationRead).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111'),
    );
    await fireEvent.press(screen.getByLabelText('View Leave'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/(student)/leave/[id]',
      params: { id: '22222222-2222-4222-8222-222222222222' },
    });
  });

  it('filters by category and marks everything read', async () => {
    jest.mocked(getUnreadCount).mockResolvedValue(2);
    jest
      .mocked(listNotifications)
      .mockResolvedValue(
        page([notice({ category: 'ANNOUNCEMENT', title: 'Dinner at 7:30 PM' })], 2),
      );
    jest.mocked(markAllNotificationsRead).mockResolvedValue(0);
    await renderWithProviders(<NotificationsScreen />);

    expect(await screen.findByText('Dinner at 7:30 PM')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Announcements' }));
    await waitFor(() => expect(listNotifications).toHaveBeenCalledWith('ANNOUNCEMENT', 1));

    await waitFor(() => expect(screen.getByLabelText('Mark All as Read')).not.toBeDisabled());
    await fireEvent.press(screen.getByLabelText('Mark All as Read'));
    await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalled());
  });

  it('says so when there is nothing to show', async () => {
    jest.mocked(getUnreadCount).mockResolvedValue(0);
    jest.mocked(listNotifications).mockResolvedValue(page([], 0));
    await renderWithProviders(<NotificationsScreen />);
    expect(await screen.findByText('No notifications yet.')).toBeTruthy();
  });
});
