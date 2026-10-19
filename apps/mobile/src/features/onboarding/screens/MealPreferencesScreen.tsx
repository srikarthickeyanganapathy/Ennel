import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { type MealType } from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import { QueryState } from '@/shared/components/QueryState';
import { Screen } from '@/shared/components/Screen';
import { StepHeader } from '@/shared/components/StepHeader';
import { ToggleRow } from '@/shared/components/ToggleRow';
import { MealPreferenceCard } from '../components/MealPreferenceCard';
import { useMeals } from '../hooks/use-onboarding-queries';
import { useOnboardingDraft } from '../store/onboarding-draft.store';

/** Spec §3 Screen 7: required first-time Default Booking setup. */
export function MealPreferencesScreen() {
  const router = useRouter();
  const meals = useMeals();
  const {
    meals: drafts,
    updateMeal,
    defaultBookingEnabled,
    setDefaultBookingEnabled,
  } = useOnboardingDraft();
  const [slotErrors, setSlotErrors] = useState<Partial<Record<MealType, string>>>({});

  const onContinue = () => {
    // Convenience check only; the API validates slots against the live configuration.
    const missing = (meals.data ?? []).filter((meal) => {
      const draft = drafts[meal.mealType];
      return draft.isEnabled && meal.slots.length > 1 && !draft.slotId;
    });
    setSlotErrors(
      Object.fromEntries(missing.map((meal) => [meal.mealType, 'Choose a slot for this meal'])),
    );
    if (missing.length === 0) router.push('/(onboarding)/review');
  };

  return (
    <QueryState
      isLoading={meals.isLoading}
      error={meals.error}
      onRetry={meals.refetch}
      loadingLabel="Loading meal times"
    >
      <Screen footer={<AppButton label="Review Details" onPress={onContinue} />}>
        <StepHeader
          step="Step 3 of 4"
          title="Meal preferences"
          subtitle="Choose the meals to book automatically. You can change one day later without changing these."
        />
        <ToggleRow
          label="Default Booking"
          description="Turns automatic booking on or off for all meals. Your choices below are kept either way."
          value={defaultBookingEnabled}
          onChange={setDefaultBookingEnabled}
        />
        <Text className="mb-4 mt-2 text-sm font-semibold text-foreground">Meals</Text>
        {(meals.data ?? []).map((meal) => (
          <MealPreferenceCard
            key={meal.id}
            meal={meal}
            draft={drafts[meal.mealType]}
            onChange={(changes) => updateMeal(meal.mealType, changes)}
            error={slotErrors[meal.mealType]}
          />
        ))}
      </Screen>
    </QueryState>
  );
}
