import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { type MealType } from '@ennel/shared';
import { MessageBanner } from '@/shared/components/MessageBanner';
import { useNoShowSummary } from '../hooks/use-no-shows';
import { isDismissible, warningText } from '../utils/no-show-text';

/** Spec §10 Home warnings: dismissible at three, staying from four, a notice once off. */
export function NoShowWarnings() {
  const router = useRouter();
  const summary = useNoShowSummary();
  // Dismissed for this visit only; a new No-show brings it back (BR-NS-4).
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  if (!summary.data) return null;
  const data = summary.data;
  const shown = data.meals
    .map((meal) => ({ meal, text: warningText(meal, data) }))
    .filter(
      (item): item is { meal: (typeof data.meals)[number]; text: string } =>
        item.text !== null && !dismissed.has(`${item.meal.mealType}:${item.meal.count}`),
    );
  if (shown.length === 0) return null;
  const dismiss = (mealType: MealType, count: number) =>
    setDismissed((current) => new Set(current).add(`${mealType}:${count}`));
  return (
    <View className="mb-2">
      {shown.map(({ meal, text }) => (
        <View key={meal.mealType}>
          <MessageBanner tone="warning" message={text} />
          <View className="-mt-2 mb-3 flex-row gap-4">
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(student)/no-shows')}
            >
              <Text className="text-sm font-semibold text-primary">View No-shows</Text>
            </Pressable>
            {isDismissible(meal, data) ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Dismiss the ${meal.mealName} warning`}
                onPress={() => dismiss(meal.mealType, meal.count)}
              >
                <Text className="text-sm text-muted-foreground">Dismiss</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}
