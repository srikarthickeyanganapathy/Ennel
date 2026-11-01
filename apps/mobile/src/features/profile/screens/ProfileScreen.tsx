import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useLogout } from '@/features/auth/hooks/use-auth-mutations';
import { useNoShowSummary } from '@/features/no-shows/hooks/use-no-shows';
import { AppButton } from '@/shared/components/AppButton';
import { Screen } from '@/shared/components/Screen';
import { StepHeader } from '@/shared/components/StepHeader';
import { confirmAction } from '@/shared/utils/confirm-action';

/** Spec §9 (in progress): No-show counts (Spec §10) and Logout with confirmation (Spec §14). */
export function ProfileScreen() {
  const router = useRouter();
  const logout = useLogout();
  const noShows = useNoShowSummary();

  const confirmLogout = async () => {
    const isConfirmed = await confirmAction({
      title: 'Log out?',
      message: 'You will need your reference number and password to log in again.',
      cancelLabel: 'Stay Logged In',
      confirmLabel: 'Log Out',
      isDestructive: true,
    });
    // The signed-out session sends the student to Login (SessionGate); no navigation here.
    if (isConfirmed) logout.mutate();
  };

  return (
    <Screen>
      <StepHeader title="Profile" subtitle="Your details and settings will appear here." />
      {noShows.data ? (
        <View className="mb-6 rounded-lg border border-border bg-background p-4">
          <Text className="mb-2 text-base font-semibold text-foreground" accessibilityRole="header">
            No-shows (last {noShows.data.windowDays} days)
          </Text>
          {noShows.data.meals.map((meal) => (
            <Text key={meal.mealType} className="text-sm text-foreground">
              {meal.mealName}: {meal.count}
              {meal.isAutoDisabled ? ' · Default Booking off' : ''}
            </Text>
          ))}
          <View className="mt-3">
            <AppButton
              label="View No-shows"
              variant="secondary"
              onPress={() => router.push('/(student)/no-shows')}
            />
          </View>
        </View>
      ) : null}
      <AppButton
        label="Log Out"
        variant="danger"
        onPress={() => void confirmLogout()}
        isLoading={logout.isPending}
      />
    </Screen>
  );
}
