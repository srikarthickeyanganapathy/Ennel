import { Text, View } from 'react-native';
import {
  type DefaultMealSettings,
  DietType,
  formatMinuteOfDay,
  type MealPreferenceInput,
} from '@ennel/shared';
import { OptionList } from '@/shared/components/OptionList';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import { ToggleRow } from '@/shared/components/ToggleRow';
import { needsSlotChoice } from '../utils/default-booking-text';

const DIET_OPTIONS = [
  { value: DietType.VEG, label: 'Veg' },
  { value: DietType.NON_VEG, label: 'Non-Veg' },
];

interface MealSettingsFormProps {
  meal: DefaultMealSettings;
  draft: MealPreferenceInput;
  onChange: (changes: Partial<MealPreferenceInput>) => void;
  error?: string | null;
}

/** One meal's recurring settings: ON/OFF, slot and meal type (Spec §8.2, §8.3). */
export function MealSettingsForm({ meal, draft, onChange, error }: MealSettingsFormProps) {
  const window = `${formatMinuteOfDay(meal.serviceStartMinute)} - ${formatMinuteOfDay(meal.serviceEndMinute)}`;
  return (
    <View>
      <ToggleRow
        label={`Book ${meal.mealName} automatically`}
        description={`Serving ${window}`}
        value={draft.isEnabled}
        onChange={(isEnabled) => onChange({ isEnabled })}
      />
      <SegmentedControl
        label="Meal type"
        options={DIET_OPTIONS}
        selected={draft.dietType}
        onSelect={(dietType) => onChange({ dietType: dietType as DietType })}
      />
      <Text className="mb-3 text-xs text-muted-foreground">Subject to the menu on the day.</Text>
      {needsSlotChoice(meal) ? (
        <OptionList
          label={`Preferred ${meal.mealName.toLowerCase()} slot`}
          options={meal.slots.map((slot) => ({ value: slot.slotId, label: slot.label }))}
          selected={draft.slotId}
          onSelect={(slotId) => onChange({ slotId })}
          error={error ?? undefined}
        />
      ) : null}
    </View>
  );
}
