import { Text, View } from 'react-native';
import { DietType, formatMinuteOfDay, type MealConfig } from '@ennel/shared';
import { OptionList } from '@/shared/components/OptionList';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import { ToggleRow } from '@/shared/components/ToggleRow';
import { type MealDraft } from '../store/onboarding-draft.store';

const DIET_OPTIONS = [
  { value: DietType.VEG, label: 'Veg' },
  { value: DietType.NON_VEG, label: 'Non-Veg' },
];

interface MealPreferenceCardProps {
  meal: MealConfig;
  draft: MealDraft;
  onChange: (changes: Partial<MealDraft>) => void;
  error?: string;
}

/** One meal's recurring preference (Spec §3 Screen 7). */
export function MealPreferenceCard({ meal, draft, onChange, error }: MealPreferenceCardProps) {
  const hasSingleWindow = meal.slots.length === 1;
  return (
    <View className="mb-4 rounded-lg border border-border bg-background p-4">
      <ToggleRow
        label={meal.displayName}
        description={
          hasSingleWindow
            ? `Serving ${formatMinuteOfDay(meal.serviceStartMinute)} - ${formatMinuteOfDay(meal.serviceEndMinute)}`
            : `Book ${meal.displayName.toLowerCase()} automatically`
        }
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
      {hasSingleWindow ? null : (
        <OptionList
          label={`Default ${meal.displayName.toLowerCase()} slot`}
          options={meal.slots.map((slot) => ({ value: slot.id, label: slot.label }))}
          selected={draft.slotId}
          onSelect={(slotId) => onChange({ slotId })}
          error={error}
        />
      )}
    </View>
  );
}
