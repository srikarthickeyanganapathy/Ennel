import { Redirect, Stack } from 'expo-router';
import { THEME_COLORS } from '@ennel/shared';
import { useSessionStore } from '@/shared/store/session.store';

/** Setup screens need a session; a finished setup goes to Home. */
export default function OnboardingLayout() {
  const status = useSessionStore((state) => state.status);
  const isOnboardingComplete = useSessionStore((state) => state.isOnboardingComplete);
  if (status !== 'signedIn') return <Redirect href="/" />;
  if (isOnboardingComplete) return <Redirect href="/(tabs)" />;
  return (
    <Stack
      screenOptions={{
        headerTitle: '',
        headerShadowVisible: false,
        headerTintColor: THEME_COLORS.primary,
      }}
    >
      <Stack.Screen name="profile" options={{ headerBackVisible: false }} />
    </Stack>
  );
}
