import { Stack } from 'expo-router';
import { THEME_COLORS } from '@ennel/shared';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitle: '',
        headerShadowVisible: false,
        headerTintColor: THEME_COLORS.primary,
      }}
    >
      <Stack.Screen
        name="account-created"
        options={{ headerShown: false, gestureEnabled: false }}
      />
    </Stack>
  );
}
