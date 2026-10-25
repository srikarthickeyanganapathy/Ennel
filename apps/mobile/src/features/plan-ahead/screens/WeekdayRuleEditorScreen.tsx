import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import {
  type DefaultMealSettings,
  DietType,
  type MealType,
  type WeekdayRule,
  type WeekdayRuleResult,
} from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import { MessageBanner } from '@/shared/components/MessageBanner';
import { OptionList } from '@/shared/components/OptionList';
import { QueryState } from '@/shared/components/QueryState';
import { Screen } from '@/shared/components/Screen';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import { useSubmitLock } from '@/shared/hooks/use-submit-lock';
import { confirmAction } from '@/shared/utils/confirm-action';
import { useDefaultPreferences } from '@/features/default-booking/hooks/use-default-preferences';
import { needsSlotChoice } from '@/features/default-booking/utils/default-booking-text';
import { ChoiceChip } from '../components/ChoiceChip';
import {
  useCreateWeekdayRules,
  useDeleteWeekdayRule,
  useUpdateWeekdayRule,
  useWeekdayRules,
} from '../hooks/use-weekday-rules';
import { describeRule, WEEKDAY_LONG, WEEKDAY_ORDER, WEEKDAY_SHORT } from '../utils/weekdays';

const DIET_OPTIONS = [
  { value: DietType.VEG, label: 'Veg' },
  { value: DietType.NON_VEG, label: 'Non-Veg' },
];

interface MealChoice {
  isIncluded: boolean;
  slotId: string | null;
  dietType: DietType;
}

/** Spec §6.2: create a weekday rule (one or more meals) or edit and delete one. */
export function WeekdayRuleEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const preferences = useDefaultPreferences();
  const rules = useWeekdayRules();
  const rule = id ? rules.data?.find((candidate) => candidate.id === id) : undefined;
  const isLoading = preferences.isLoading || (Boolean(id) && rules.isLoading);
  return (
    <QueryState
      isLoading={isLoading}
      error={preferences.error ?? rules.error}
      onRetry={() => void (preferences.refetch(), rules.refetch())}
      loadingLabel="Loading meal slots"
    >
      {preferences.data && (!id || rule) ? (
        <RuleEditor meals={preferences.data.meals} rule={rule} />
      ) : (
        <Screen>
          <MessageBanner message="This weekday rule was not found. It may have been deleted." />
        </Screen>
      )}
    </QueryState>
  );
}

/** New rules start from each meal's Default Booking meal type; a single serving window is preset. */
function initialChoices(
  meals: DefaultMealSettings[],
  rule: WeekdayRule | undefined,
): Record<MealType, MealChoice> {
  const entries = meals.map((meal) => {
    const only = needsSlotChoice(meal) ? null : (meal.slots[0]?.slotId ?? null);
    const choice: MealChoice =
      rule?.mealType === meal.mealType
        ? { isIncluded: true, slotId: rule.slotId, dietType: rule.dietType }
        : { isIncluded: false, slotId: only, dietType: meal.dietType };
    return [meal.mealType, choice] as const;
  });
  return Object.fromEntries(entries) as Record<MealType, MealChoice>;
}

function RuleEditor({ meals, rule }: { meals: DefaultMealSettings[]; rule?: WeekdayRule }) {
  const router = useRouter();
  const runOnce = useSubmitLock();
  const create = useCreateWeekdayRules();
  const update = useUpdateWeekdayRule();
  const remove = useDeleteWeekdayRule();
  const [weekdays, setWeekdays] = useState<number[]>(rule?.weekdays ?? []);
  const [choices, setChoices] = useState(() => initialChoices(meals, rule));
  const [problem, setProblem] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const error = create.error ?? update.error ?? remove.error;
  const isSaving = create.isPending || update.isPending || remove.isPending;
  const visibleMeals = rule ? meals.filter((meal) => meal.mealType === rule.mealType) : meals;

  const edit = (mealType: MealType, changes: Partial<MealChoice>) => {
    setSummary(null);
    setChoices((current) => ({ ...current, [mealType]: { ...current[mealType], ...changes } }));
  };
  const toggleDay = (day: number) => {
    setSummary(null);
    setWeekdays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day],
    );
  };

  const finish = (result: WeekdayRuleResult, verb: string) =>
    setSummary(
      `Rule ${verb}. ${result.bookingsUpdated} upcoming ${result.bookingsUpdated === 1 ? 'booking was' : 'bookings were'} updated.`,
    );

  const onSave = () =>
    runOnce(async () => {
      const found = validate(weekdays, visibleMeals, choices);
      setProblem(found);
      if (found) return;
      if (rule) {
        const choice = choices[rule.mealType];
        const result = await update.mutateAsync({
          id: rule.id,
          body: {
            weekdays,
            slotId: choice.slotId ?? undefined,
            dietType: choice.dietType,
            version: rule.version,
          },
        });
        return finish(result, 'saved');
      }
      const selected = visibleMeals.filter((meal) => choices[meal.mealType].isIncluded);
      const result = await create.mutateAsync({
        weekdays,
        meals: selected.map((meal) => ({
          mealType: meal.mealType,
          slotId: choices[meal.mealType].slotId ?? '',
          dietType: choices[meal.mealType].dietType,
        })),
      });
      return finish(result, selected.length > 1 ? 'saved for each meal' : 'saved');
    });

  const onDelete = () =>
    runOnce(async () => {
      if (!rule) return;
      const isConfirmed = await confirmAction({
        title: 'Delete this rule?',
        message: `${describeRule(rule)}. Those days go back to your normal Default Booking.`,
        cancelLabel: 'Keep Rule',
        confirmLabel: 'Delete Rule',
        isDestructive: true,
      });
      if (!isConfirmed) return;
      await remove.mutateAsync({ id: rule.id, version: rule.version });
      router.back();
    });

  return (
    <Screen
      footer={
        summary ? (
          <AppButton label="Back to Plan Ahead" onPress={() => router.back()} />
        ) : (
          <AppButton label="Save Rule" isLoading={isSaving} onPress={onSave} />
        )
      }
    >
      <Text className="mb-1 text-2xl font-bold text-foreground">
        {rule ? `Edit ${rule.mealName} rule` : 'Choose a Day'}
      </Text>
      <Text className="mb-4 text-sm text-muted-foreground">
        On the days you pick, the chosen slot is booked instead of your Default Booking. Other days
        stay as they are.
      </Text>
      {summary ? <MessageBanner tone="success" message={summary} /> : null}
      {problem ? <MessageBanner message={problem} /> : null}
      {error ? <MessageBanner message={error.message} /> : null}

      <Text className="mb-2 text-sm font-medium text-foreground">Days</Text>
      <View className="mb-4 flex-row flex-wrap">
        {WEEKDAY_ORDER.map((day) => (
          <ChoiceChip
            key={day}
            label={WEEKDAY_SHORT[day]}
            accessibilityLabel={WEEKDAY_LONG[day]}
            isChecked={weekdays.includes(day)}
            onToggle={() => toggleDay(day)}
          />
        ))}
      </View>

      {rule ? null : <Text className="mb-2 text-sm font-medium text-foreground">Meals</Text>}
      {visibleMeals.map((meal) => (
        <MealRuleSection
          key={meal.mealType}
          meal={meal}
          choice={choices[meal.mealType]}
          canToggle={!rule}
          onChange={(changes) => edit(meal.mealType, changes)}
        />
      ))}
      {rule ? (
        <View className="mb-6 mt-2">
          <AppButton
            label="Delete Rule"
            variant="danger"
            isDisabled={isSaving}
            onPress={onDelete}
          />
        </View>
      ) : null}
    </Screen>
  );
}

function MealRuleSection({
  meal,
  choice,
  canToggle,
  onChange,
}: {
  meal: DefaultMealSettings;
  choice: MealChoice;
  canToggle: boolean;
  onChange: (changes: Partial<MealChoice>) => void;
}) {
  return (
    <View className="mb-3 rounded-lg border border-border bg-background p-4">
      {canToggle ? (
        <ChoiceChip
          label={meal.mealName}
          accessibilityLabel={`Include ${meal.mealName}`}
          isChecked={choice.isIncluded}
          onToggle={() => onChange({ isIncluded: !choice.isIncluded })}
        />
      ) : (
        <Text className="mb-2 text-lg font-semibold text-foreground">{meal.mealName}</Text>
      )}
      {choice.isIncluded ? (
        <View className="mt-2">
          {needsSlotChoice(meal) ? (
            <OptionList
              label={`${meal.mealName} slot on these days`}
              options={meal.slots.map((slot) => ({ value: slot.slotId, label: slot.label }))}
              selected={choice.slotId}
              onSelect={(slotId) => onChange({ slotId })}
            />
          ) : null}
          <SegmentedControl
            label="Meal type"
            options={DIET_OPTIONS}
            selected={choice.dietType}
            onSelect={(dietType) => onChange({ dietType: dietType as DietType })}
          />
          <Text className="text-xs text-muted-foreground">Subject to the menu on the day.</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Convenience checks only; the API validates slots and overlapping days (ADR-0014). */
function validate(
  weekdays: number[],
  meals: DefaultMealSettings[],
  choices: Record<MealType, MealChoice>,
): string | null {
  if (weekdays.length === 0) return 'Choose at least one day.';
  const included = meals.filter((meal) => choices[meal.mealType].isIncluded);
  if (included.length === 0) return 'Choose at least one meal.';
  const missing = included.find((meal) => !choices[meal.mealType].slotId);
  return missing ? `Choose a ${missing.mealName.toLowerCase()} slot.` : null;
}
