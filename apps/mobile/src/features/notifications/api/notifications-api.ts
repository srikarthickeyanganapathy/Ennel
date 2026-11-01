import {
  type NotificationCategory,
  type NotificationList,
  notificationListResponseSchema,
  unreadCountSchema,
} from '@ennel/shared';
import { apiRequest } from '@/shared/api-client/api-client';

export function listNotifications(
  category: NotificationCategory | null,
  page: number,
): Promise<NotificationList> {
  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (category) params.set('category', category);
  return apiRequest(`/api/v1/notifications?${params.toString()}`, {
    schema: notificationListResponseSchema,
  });
}

export async function getUnreadCount(): Promise<number> {
  const result = await apiRequest('/api/v1/notifications/unread-count', {
    schema: unreadCountSchema,
  });
  return result.unreadCount;
}

export async function markNotificationRead(id: string): Promise<number> {
  const result = await apiRequest(`/api/v1/notifications/${id}/read`, {
    method: 'POST',
    schema: unreadCountSchema,
  });
  return result.unreadCount;
}

export async function markAllNotificationsRead(): Promise<number> {
  const result = await apiRequest('/api/v1/notifications/read-all', {
    method: 'POST',
    schema: unreadCountSchema,
  });
  return result.unreadCount;
}

export function registerPushToken(token: string, platform: 'ios' | 'android'): Promise<void> {
  return apiRequest('/api/v1/push-tokens', { method: 'PUT', body: { token, platform } });
}
