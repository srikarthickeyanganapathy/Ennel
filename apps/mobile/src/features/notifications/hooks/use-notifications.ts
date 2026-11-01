import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type NotificationCategory, type NotificationList } from '@ennel/shared';
import { type ApiError } from '@/shared/api-client/api-error';
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notifications-api';

export const unreadCountKey = ['notifications', 'unread-count'] as const;
const listKey = (category: NotificationCategory | null) =>
  ['notifications', 'list', category ?? 'ALL'] as const;

/** The bell badge (Spec §13). Refreshed every minute while the app is open. */
export function useUnreadCount() {
  return useQuery<number, ApiError>({
    queryKey: unreadCountKey,
    queryFn: getUnreadCount,
    refetchInterval: 60_000,
  });
}

export function useNotifications(category: NotificationCategory | null) {
  return useInfiniteQuery<NotificationList, ApiError>({
    queryKey: listKey(category),
    queryFn: ({ pageParam }) => listNotifications(category, Number(pageParam)),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
  });
}

/** Reading updates the badge at once and refetches the lists so the row shows as read. */
function useReadMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<number>) {
  const queryClient = useQueryClient();
  return useMutation<number, ApiError, TVariables>({
    mutationFn,
    onSuccess: (unreadCount) => {
      queryClient.setQueryData(unreadCountKey, unreadCount);
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
    },
  });
}

export function useMarkRead() {
  return useReadMutation((id: string) => markNotificationRead(id));
}

export function useMarkAllRead() {
  return useReadMutation((_: void) => markAllNotificationsRead());
}
