import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import {
  type DefaultMealSettings,
  type MealPreferenceInput,
  mealTypeSchema,
  type UpdateMealPreferenceRequest,
} from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import { MessageBanner } from '@/shared/components/MessageBanner';
import { QueryState } from '@/shared/components/QueryState';
import { Screen } from '@/shared/components/Screen';
import { useSubmitLock } from '@/shared/hooks/use-submit-lock';
import { MealSettingsForm } from '../components/MealSettingsForm';
import { useDefaultPreferences, useUpdateMealPreference } from '../hooks/use-default-preferences';
import { describeSaveResult, slotProblem, toMealInput } from '../utils/default-booking-text';

/** Spec §8.2: one meal's settings; "Save Changes" saves only this meal. */
export function EditDefaultMealScreen() {
  const { meal: mealParam } = useLocalSearchParams<{ meal?: string }>();
  const mealType = mealTypeSchema.safeParse(mealParam);
  const preferences = useDefaultPreferences();
  const meal = preferences.data?.meals.find((candidate) => candidate.mealType === mealType.data);
  return (
    <QueryState
      isLoading={preferences.isLoading}
      error={preferences.error}
      onRetry={preferences.refetch}
      loadingLabel="Loading meal settings"
    >
      {meal ? (
        <EditMealContent meal={meal} />
      ) : (
        <Screen>
          <MessageBanner message="This meal was not found." />
        </Screen>
      )}
    </QueryState>
  );
}

/** Only the settings the student changed are sent (Spec §8.2: other meals stay unchanged). */
function changedFields(
  meal: DefaultMealSettings,
  draft: MealPreferenceInput,
): UpdateMealPreferenceRequest {
  return {
    ...(draft.isEnabled !== meal.isEnabled && { isEnabled: draft.isEnabled }),
    ...(draft.slotId !== meal.slotId && { slotId: draft.slotId }),
    ...(draft.dietType !== meal.dietType && { dietType: draft.dietType }),
  };
}

function EditMealContent({ meal }: { meal: DefaultMealSettings }) {
  const router = useRouter();
  const update = useUpdateMealPreference();
  const runOnce = useSubmitLock();
  const [draft, setDraft] = useState<MealPreferenceInput>(() => toMealInput(meal));
  const [problem, setProblem] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const body = changedFields(meal, draft);
  const hasChanges = Object.keys(body).length > 0;

  const onSave = () =>
    runOnce(async () => {
      const found = slotProblem(meal, draft);
      setProblem(found);
      if (found) return;
      const result = await update.mutateAsync({ mealType: meal.mealType, body });
      setSummary(describeSaveResult(result.changes, result.bookingsUpdated));
    });

  return (
    <Screen
      footer={
        summary ? (
          <AppButton label="Back to Default Booking" onPress={() => router.back()} />
        ) : (
          <AppButton
            label="Save Changes"
            isLoading={update.isPending}
            isDisabled={!hasChanges}
            onPress={onSave}
          />
        )
      }
    >
      <Text className="mb-1 text-2xl font-bold text-foreground">{meal.mealName} settings</Text>
      <Text className="mb-4 text-sm text-muted-foreground">
        Changes here apply to every day that is booked automatically. Breakfast, Lunch and Dinner
        are saved separately.
      </Text>
      {summary ? <MessageBanner tone="success" message={summary} /> : null}
      {update.error ? <MessageBanner message={update.error.message} /> : null}
      <MealSettingsForm
        meal={meal}
        draft={draft}
        error={problem}
        onChange={(changes) => {
          setSummary(null);
          setDraft((current) => ({ ...current, ...changes }));
        }}
      />
    </Screen>
  );
}
