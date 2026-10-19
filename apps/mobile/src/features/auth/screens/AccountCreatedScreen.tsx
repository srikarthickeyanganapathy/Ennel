import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { AppButton } from '@/shared/components/AppButton';
import { Screen } from '@/shared/components/Screen';

/** Spec §3 Screen 4: continue into profile completion, never straight to Home. */
export function AccountCreatedScreen() {
  const router = useRouter();
  return (
    <Screen
      footer={
        <AppButton label="Continue" onPress={() => router.replace('/(onboarding)/profile')} />
      }
    >
      <View className="items-center py-16">
        <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-mint">
          <Text className="text-3xl font-bold text-primary" accessibilityElementsHidden>
            ✓
          </Text>
        </View>
        <Text accessibilityRole="header" className="text-2xl font-bold text-foreground">
          Account created
        </Text>
        <Text className="mt-2 text-center text-base text-muted-foreground">
          Next, check your details and choose the meals you usually eat.
        </Text>
      </View>
    </Screen>
  );
}
