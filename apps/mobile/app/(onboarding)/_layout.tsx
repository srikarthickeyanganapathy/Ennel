import { Stack } from 'expo-router';
import { THEME_COLORS } from '@ennel/shared';
import { SessionGate } from '@/shared/components/SessionGate';
import { useSessionStore } from '@/shared/store/session.store';

/** Setup screens need a session; a finished setup goes to Home. */
export default function OnboardingLayout() {
  const isOnboardingComplete = useSessionStore((state) => state.isOnboardingComplete);
  return (
    <SessionGate redirectTo={isOnboardingComplete ? '/(tabs)' : null}>
      <Stack
        screenOptions={{
          headerTitle: '',
          headerShadowVisible: false,
          headerTintColor: THEME_COLORS.primary,
        }}
      >
        <Stack.Screen name="profile" options={{ headerBackVisible: false }} />
      </Stack>
    </SessionGate>
  );
}
