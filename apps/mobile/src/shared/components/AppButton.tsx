import { ActivityIndicator, Pressable, Text } from 'react-native';
import { THEME_COLORS } from '@ennel/shared';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  isLoading?: boolean;
  isDisabled?: boolean;
  accessibilityHint?: string;
}

const CONTAINER = {
  primary: 'bg-primary',
  secondary: 'border border-primary bg-background',
  danger: 'bg-danger',
} as const;

const LABEL = {
  primary: 'text-primary-foreground',
  secondary: 'text-primary',
  danger: 'text-primary-foreground',
} as const;

/**
 * Spec §14: shows a loading state and ignores taps while busy, so a submit cannot be sent twice.
 */
export function AppButton({
  label,
  onPress,
  variant = 'primary',
  isLoading = false,
  isDisabled = false,
  accessibilityHint,
}: AppButtonProps) {
  const isInactive = isDisabled || isLoading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isInactive, busy: isLoading }}
      disabled={isInactive}
      onPress={onPress}
      className={`min-h-12 flex-row items-center justify-center rounded-lg px-4 py-3 ${CONTAINER[variant]} ${isInactive ? 'opacity-60' : ''}`}
    >
      {isLoading ? (
        <ActivityIndicator
          color={variant === 'secondary' ? THEME_COLORS.primary : THEME_COLORS.primaryForeground}
          className="mr-2"
        />
      ) : null}
      <Text className={`text-base font-semibold ${LABEL[variant]}`}>{label}</Text>
    </Pressable>
  );
}
