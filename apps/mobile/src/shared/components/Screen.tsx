import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScreenProps {
  children: ReactNode;
  /** Pinned below the scrolling content, e.g. the primary action. */
  footer?: ReactNode;
}

export function Screen({ children, footer }: ScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 py-6"
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
        {footer ? (
          <View className="border-t border-border bg-background px-5 py-4">{footer}</View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
