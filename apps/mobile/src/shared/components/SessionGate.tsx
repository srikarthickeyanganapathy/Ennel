import { type Href, Redirect } from 'expo-router';
import { type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { THEME_COLORS } from '@ennel/shared';
import { useSessionStore } from '../store/session.store';

interface SessionGateProps {
  /** Where a signed-in student belongs instead, e.g. Home once setup is finished. */
  redirectTo: Href | null;
  children: ReactNode;
}

/**
 * Guards the signed-in route groups. A signed-out student goes to Login (Spec §9 Logout).
 * Never redirect to "/" from here: both app/index and app/(tabs)/index match "/", so from
 * inside the tabs it resolves to the tabs again and the redirect loops forever.
 */
export function SessionGate({ redirectTo, children }: SessionGateProps) {
  const status = useSessionStore((state) => state.status);
  if (status === 'restoring') {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator
          accessibilityLabel="Checking your session"
          color={THEME_COLORS.primary}
        />
      </View>
    );
  }
  if (status === 'signedOut') return <Redirect href="/(auth)/login" />;
  if (redirectTo) return <Redirect href={redirectTo} />;
  return <>{children}</>;
}
