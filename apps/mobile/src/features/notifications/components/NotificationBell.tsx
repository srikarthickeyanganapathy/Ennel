import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useUnreadCount } from '../hooks/use-notifications';

/** Spec §13: the bell on Home opens Notifications; the badge shows the unread count. */
export function NotificationBell() {
  const router = useRouter();
  const unread = useUnreadCount().data ?? 0;
  const label = unread > 0 ? `Notifications, ${unread} unread` : 'Notifications';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push('/(student)/notifications')}
      className="min-h-11 min-w-11 items-center justify-center rounded-full border border-border bg-background px-3"
    >
      <Text className="text-lg" importantForAccessibility="no">
        🔔
      </Text>
      {unread > 0 ? (
        <View className="absolute -right-1 -top-1 min-w-5 items-center rounded-full bg-danger px-1">
          <Text className="text-xs font-bold text-primary-foreground">
            {unread > 99 ? '99+' : unread}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
