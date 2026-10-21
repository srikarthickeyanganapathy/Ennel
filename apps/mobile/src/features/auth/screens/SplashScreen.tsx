import { useRouter } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME_COLORS } from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import { useSessionStore } from '@/shared/store/session.store';
import { useRestoreSession } from '../hooks/use-restore-session';
import { useSignedInRedirect } from '../hooks/use-signed-in-redirect';

/** Spec §3 Screen 1. Signed-in students skip straight to where they left off. */
export function SplashScreen() {
  const router = useRouter();
  const status = useSessionStore((state) => state.status);
  useRestoreSession();
  useSignedInRedirect();

  return (
    <SafeAreaView className="flex-1 bg-primary">
      <View className="flex-1 items-center justify-center px-6">
        <Text accessibilityRole="header" className="text-5xl font-bold text-primary-foreground">
          ENNEL
        </Text>
        <Text className="mt-3 text-lg text-mint">Good Food. Better You.</Text>
      </View>
      <View className="px-6 pb-8">
        {status === 'signedOut' ? (
          <View className="rounded-lg bg-mint">
            <AppButton
              label="Get Started"
              variant="secondary"
              onPress={() => router.push('/(auth)/reference-number')}
            />
          </View>
        ) : (
          <ActivityIndicator
            accessibilityLabel="Checking your session"
            color={THEME_COLORS.primaryForeground}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
