import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Spec §3 Screen 1. "Get Started" opens the reference-number screen once Phase 1 adds it. */
export function SplashScreen() {
  return (
    <SafeAreaView className="flex-1 bg-primary">
      <View className="flex-1 items-center justify-center px-6">
        <Text accessibilityRole="header" className="text-5xl font-bold text-primary-foreground">
          ENNEL
        </Text>
        <Text className="mt-3 text-lg text-mint">Good Food. Better You.</Text>
      </View>
      <View className="px-6 pb-8">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          accessibilityHint="Sign-up is not available yet"
          disabled
          className="items-center rounded-lg bg-mint py-4 opacity-60"
        >
          <Text className="text-base font-semibold text-primary">Get Started</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
