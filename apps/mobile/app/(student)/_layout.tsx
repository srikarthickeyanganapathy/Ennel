import { Stack } from 'expo-router';
import { THEME_COLORS } from '@ennel/shared';
import { SessionGate } from '@/shared/components/SessionGate';
import { useSessionStore } from '@/shared/store/session.store';

/** Signed-in screens outside the tab bar (e.g. Slot Selection), with a Back header. */
export default function StudentStackLayout() {
  const isOnboardingComplete = useSessionStore((state) => state.isOnboardingComplete);
  return (
    <SessionGate redirectTo={isOnboardingComplete ? null : '/(onboarding)/profile'}>
      <Stack
        screenOptions={{
          headerTitle: '',
          headerShadowVisible: false,
          headerTintColor: THEME_COLORS.primary,
          headerBackTitle: 'Back',
        }}
      />
    </SessionGate>
  );
}
