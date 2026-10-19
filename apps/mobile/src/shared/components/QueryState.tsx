import { type ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { THEME_COLORS } from '@ennel/shared';
import { AppButton } from './AppButton';
import { MessageBanner } from './MessageBanner';
import { Screen } from './Screen';

interface QueryStateProps {
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  loadingLabel: string;
  children: ReactNode;
}

/** Loading and error states for a screen that needs server data first (Spec §14). */
export function QueryState({ isLoading, error, onRetry, loadingLabel, children }: QueryStateProps) {
  if (isLoading) {
    return (
      <Screen>
        <View className="items-center py-16">
          <ActivityIndicator color={THEME_COLORS.primary} accessibilityLabel={loadingLabel} />
          <Text className="mt-3 text-base text-muted-foreground">{loadingLabel}</Text>
        </View>
      </Screen>
    );
  }
  if (error) {
    return (
      <Screen footer={<AppButton label="Try Again" onPress={onRetry} />}>
        <MessageBanner message={error.message} />
      </Screen>
    );
  }
  return <>{children}</>;
}
