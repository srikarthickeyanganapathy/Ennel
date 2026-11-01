import { Pressable, Switch, Text, View } from 'react-native';
import { type DefaultMealSettings, THEME_COLORS } from '@ennel/shared';
import { STATUS_DISPLAY } from '@/features/slots/constants/availability-display';
import { formatBusinessDate } from '@/shared/utils/format-date';

interface DefaultMealCardProps {
  meal: DefaultMealSettings;
  /** False while the overall switch is OFF: the meal keeps its setting but nothing is booked. */
  isPaused: boolean;
  isSaving: boolean;
  onToggle: (isEnabled: boolean) => void;
  onOpen: () => void;
  /** Present when the student may switch a No-show auto-disable off again (BR-NS-6). */
  onReEnable?: () => void;
}

/** A "Current Default Slots" card (Spec §8.2): opens only this meal's settings. */
export function DefaultMealCard({
  meal,
  isPaused,
  isSaving,
  onToggle,
  onOpen,
  onReEnable,
}: DefaultMealCardProps) {
  const status = meal.nextDateStatus ? STATUS_DISPLAY[meal.nextDateStatus] : null;
  const diet = meal.dietType === 'VEG' ? 'Veg' : 'Non-Veg';
  return (
    <View className="mb-3 rounded-lg border border-border bg-background p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-foreground">{meal.mealName}</Text>
        <View className="flex-row items-center">
          <Text className="mr-2 text-sm font-medium text-muted-foreground">
            {meal.isEnabled ? 'ON' : 'OFF'}
          </Text>
          <Switch
            accessibilityLabel={`${meal.mealName} automatic booking`}
            value={meal.isEnabled}
            disabled={isSaving}
            onValueChange={onToggle}
            trackColor={{ true: THEME_COLORS.primary, false: THEME_COLORS.border }}
          />
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${meal.mealName} settings`}
        onPress={onOpen}
        className="mt-2 flex-row items-center justify-between"
      >
        <View className="flex-1">
          <Text className="text-sm text-foreground">
            {meal.slotLabel ?? 'No slot chosen'} · {diet}
          </Text>
          {meal.isEnabled && !isPaused && !meal.isAutoDisabled && status ? (
            <View className="mt-1 flex-row items-center">
              <Text
                className={`rounded px-2 py-0.5 text-xs font-semibold ${status.badgeClassName}`}
              >
                {status.label}
              </Text>
              <Text className="ml-2 text-xs text-muted-foreground">
                for {formatBusinessDate(meal.nextDate)}
              </Text>
            </View>
          ) : null}
        </View>
        <Text className="text-base font-semibold text-primary">Edit ›</Text>
      </Pressable>
      {meal.isAutoDisabled ? (
        <View className="mt-2">
          <Text className="text-xs text-warning">
            Turned off after repeated No-shows. You can still book this meal yourself, and your slot
            and meal type are kept.
            {onReEnable
              ? ''
              : ' It can be switched back on once your No-shows for this meal are below the limit, or by the mess office.'}
          </Text>
          {onReEnable ? (
            <Pressable
              accessibilityRole="button"
              onPress={onReEnable}
              disabled={isSaving}
              className="mt-1 py-1"
            >
              <Text className="text-sm font-semibold text-primary">
                Turn Default Booking back on
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
