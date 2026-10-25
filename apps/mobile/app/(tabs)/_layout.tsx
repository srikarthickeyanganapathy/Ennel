import { Tabs } from 'expo-router';
import { THEME_COLORS } from '@ennel/shared';
import { SessionGate } from '@/shared/components/SessionGate';
import { useSessionStore } from '@/shared/store/session.store';

// The Complaints tab arrives with its phase.
export default function TabsLayout() {
  const isOnboardingComplete = useSessionStore((state) => state.isOnboardingComplete);
  return (
    <SessionGate redirectTo={isOnboardingComplete ? null : '/(onboarding)/profile'}>
      <Tabs
        screenOptions={{ tabBarActiveTintColor: THEME_COLORS.primary, headerShadowVisible: false }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="my-bookings" options={{ title: 'My Bookings' }} />
        <Tabs.Screen name="default-booking" options={{ title: 'Default Booking' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      </Tabs>
    </SessionGate>
  );
}
