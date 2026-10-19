import { Text, View } from 'react-native';

interface StepHeaderProps {
  title: string;
  subtitle?: string;
  /** e.g. "Step 2 of 4" for the first-time setup flow. */
  step?: string;
}

export function StepHeader({ title, subtitle, step }: StepHeaderProps) {
  return (
    <View className="mb-6">
      {step ? <Text className="mb-1 text-sm font-medium text-primary">{step}</Text> : null}
      <Text accessibilityRole="header" className="text-2xl font-bold text-foreground">
        {title}
      </Text>
      {subtitle ? <Text className="mt-2 text-base text-muted-foreground">{subtitle}</Text> : null}
    </View>
  );
}
