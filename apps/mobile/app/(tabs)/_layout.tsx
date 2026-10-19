import { Redirect, Tabs } from 'expo-router';
import { THEME_COLORS } from '@ennel/shared';
import { useSessionStore } from '@/shared/store/session.store';

// The remaining tabs (My Bookings, Default Booking, Complaints) arrive with their phases.
export default function TabsLayout() {
  const status = useSessionStore((state) => state.status);
  const isOnboardingComplete = useSessionStore((state) => state.isOnboardingComplete);
  if (status !== 'signedIn') return <Redirect href="/" />;
  if (!isOnboardingComplete) return <Redirect href="/(onboarding)/profile" />;
  return (
    <Tabs
      screenOptions={{ tabBarActiveTintColor: THEME_COLORS.primary, headerShadowVisible: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
