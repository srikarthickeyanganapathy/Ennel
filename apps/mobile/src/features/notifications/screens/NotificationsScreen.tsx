import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type NotificationCategory, type StudentNotification } from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import { MessageBanner } from '@/shared/components/MessageBanner';
import { QueryState } from '@/shared/components/QueryState';
import { Screen } from '@/shared/components/Screen';
import { formatDateTime } from '@/shared/utils/format-date';
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from '../hooks/use-notifications';
import { CATEGORY_LABELS, FILTERS, relatedAction } from '../utils/notification-links';

/** Spec §13 Notifications: rows open the full message, mark read, mark all, filter. */
export function NotificationsScreen() {
  const [category, setCategory] = useState<NotificationCategory | null>(null);
  const list = useNotifications(category);
  const unread = useUnreadCount().data ?? 0;
  const markAll = useMarkAllRead();
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <Screen
      footer={
        list.hasNextPage ? (
          <AppButton
            label="Show older"
            variant="secondary"
            isLoading={list.isFetchingNextPage}
            onPress={() => void list.fetchNextPage()}
          />
        ) : undefined
      }
    >
      <View className="mb-4 flex-row items-center justify-between">
        <Text accessibilityRole="header" className="text-2xl font-bold text-foreground">
          Notifications
        </Text>
        <AppButton
          label="Mark All as Read"
          variant="secondary"
          isDisabled={unread === 0}
          isLoading={markAll.isPending}
          onPress={() => markAll.mutate()}
        />
      </View>
      <FilterChips selected={category} onSelect={setCategory} />
      {markAll.error ? <MessageBanner message={markAll.error.message} /> : null}
      <QueryState
        isLoading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        loadingLabel="Loading notifications"
      >
        {items.length === 0 ? (
          <Text className="text-sm text-muted-foreground">
            {category ? 'Nothing here for this filter.' : 'No notifications yet.'}
          </Text>
        ) : null}
        {items.map((item) => (
          <NotificationRow key={item.id} notification={item} />
        ))}
      </QueryState>
    </Screen>
  );
}

function FilterChips({
  selected,
  onSelect,
}: {
  selected: NotificationCategory | null;
  onSelect: (value: NotificationCategory | null) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mb-4"
      accessibilityRole="radiogroup"
      accessibilityLabel="Filter notifications"
    >
      {FILTERS.map((filter) => {
        const isSelected = filter.value === selected;
        return (
          <Pressable
            key={filter.label}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected, checked: isSelected }}
            onPress={() => onSelect(filter.value)}
            className={`mr-2 min-h-11 justify-center rounded-full border px-4 ${isSelected ? 'border-primary bg-primary' : 'border-border bg-background'}`}
          >
            <Text
              className={isSelected ? 'font-semibold text-primary-foreground' : 'text-foreground'}
            >
              {filter.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Tapping a row opens its full message and marks it read. */
function NotificationRow({ notification }: { notification: StudentNotification }) {
  const router = useRouter();
  const markRead = useMarkRead();
  const [isOpen, setIsOpen] = useState(false);
  const isUnread = notification.readAt === null;
  const action = relatedAction(notification);

  const toggle = () => {
    setIsOpen((open) => !open);
    if (isUnread && !markRead.isPending) markRead.mutate(notification.id);
  };

  return (
    <View
      className={`mb-3 rounded-lg border p-4 ${isUnread ? 'border-primary bg-mint' : 'border-border bg-background'}`}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        accessibilityLabel={`${isUnread ? 'Unread. ' : ''}${notification.title}`}
        onPress={toggle}
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-semibold text-primary">
            {CATEGORY_LABELS[notification.category]}
            {isUnread ? ' · Unread' : ''}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {formatDateTime(notification.createdAt)}
          </Text>
        </View>
        <Text className="mt-1 text-base font-semibold text-foreground">{notification.title}</Text>
        <Text className="mt-1 text-sm text-foreground" numberOfLines={isOpen ? undefined : 2}>
          {notification.body}
        </Text>
      </Pressable>
      {isOpen && action ? (
        <View className="mt-3">
          <AppButton
            label={action.label}
            variant="secondary"
            onPress={() => router.push(action.href)}
          />
        </View>
      ) : null}
      {isUnread && !isOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Mark as Read: ${notification.title}`}
          disabled={markRead.isPending}
          onPress={() => markRead.mutate(notification.id)}
          className="mt-2 min-h-11 justify-center"
        >
          <Text className="text-sm font-semibold text-primary">Mark as Read</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
