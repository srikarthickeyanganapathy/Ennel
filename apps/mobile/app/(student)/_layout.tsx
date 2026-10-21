import { Redirect, Stack } from 'expo-router';
import { THEME_COLORS } from '@ennel/shared';
import { useSessionStore } from '@/shared/store/session.store';

/** Signed-in screens outside the tab bar (e.g. Slot Selection), with a Back header. */
export default function StudentStackLayout() {
  const status = useSessionStore((state) => state.status);
  const isOnboardingComplete = useSessionStore((state) => state.isOnboardingComplete);
  if (status !== 'signedIn') return <Redirect href="/" />;
  if (!isOnboardingComplete) return <Redirect href="/(onboarding)/profile" />;
  return (
    <Stack
      screenOptions={{
        headerTitle: '',
        headerShadowVisible: false,
        headerTintColor: THEME_COLORS.primary,
        headerBackTitle: 'Back',
      }}
    />
  );
}
