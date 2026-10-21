import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { addBusinessDays, type MealType, toBusinessDate } from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import { formatBusinessDate } from '@/shared/utils/format-date';

const MEALS: { meal: MealType; label: string }[] = [
  { meal: 'BREAKFAST', label: 'Breakfast' },
  { meal: 'LUNCH', label: 'Lunch' },
  { meal: 'DINNER', label: 'Dinner' },
];

/** Home entry to Slot Selection (Spec §5) until the full Home page arrives in Phase 4. */
export function SlotAvailabilityCard() {
  const router = useRouter();
  const today = toBusinessDate(new Date());
  const tomorrow = addBusinessDays(today, 1);
  const [date, setDate] = useState(today);

  return (
    <View className="mt-6 rounded-lg border border-border bg-surface p-4">
      <Text className="text-lg font-semibold text-foreground">Check slot availability</Text>
      <Text className="mb-3 text-sm text-muted-foreground">
        See how busy each slot is before you eat.
      </Text>
      <SegmentedControl
        label="Day"
        options={[
          { value: today, label: `Today, ${formatBusinessDate(today)}` },
          { value: tomorrow, label: `Tomorrow, ${formatBusinessDate(tomorrow)}` },
        ]}
        selected={date}
        onSelect={setDate}
      />
      <View className="mt-2 gap-2">
        {MEALS.map(({ meal, label }) => (
          <AppButton
            key={meal}
            label={`${label} Slots`}
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/(student)/slot-selection', params: { date, meal } })
            }
          />
        ))}
      </View>
    </View>
  );
}
