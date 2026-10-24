import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { type DefaultPreferences, type MealPreferenceInput, type MealType } from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import { MessageBanner } from '@/shared/components/MessageBanner';
import { QueryState } from '@/shared/components/QueryState';
import { Screen } from '@/shared/components/Screen';
import { useSubmitLock } from '@/shared/hooks/use-submit-lock';
import { MealSettingsForm } from '../components/MealSettingsForm';
import { useDefaultPreferences, useSaveDefaultPreferences } from '../hooks/use-default-preferences';
import {
  describeSaveResult,
  slotProblem,
  toMealInput,
  toSaveRequest,
} from '../utils/default-booking-text';

/** Spec §8.3: all three meals together, saved at once with a summary of what changed. */
export function ChangeSlotsScreen() {
  const preferences = useDefaultPreferences();
  return (
    <QueryState
      isLoading={preferences.isLoading}
      error={preferences.error}
      onRetry={preferences.refetch}
      loadingLabel="Loading meal settings"
    >
      {preferences.data ? <ChangeSlotsContent preferences={preferences.data} /> : null}
    </QueryState>
  );
}

function ChangeSlotsContent({ preferences }: { preferences: DefaultPreferences }) {
  const router = useRouter();
  const save = useSaveDefaultPreferences();
  const runOnce = useSubmitLock();
  const [drafts, setDrafts] = useState<MealPreferenceInput[]>(() =>
    preferences.meals.map(toMealInput),
  );
  const [expanded, setExpanded] = useState<MealType | null>(preferences.meals[0]?.mealType ?? null);
  const [problems, setProblems] = useState<Partial<Record<MealType, string>>>({});
  const [summary, setSummary] = useState<string | null>(null);

  const updateDraft = (mealType: MealType, changes: Partial<MealPreferenceInput>) => {
    setSummary(null);
    setDrafts((current) =>
      current.map((draft) => (draft.mealType === mealType ? { ...draft, ...changes } : draft)),
    );
  };

  const onSave = () =>
    runOnce(async () => {
      const found = preferences.meals.flatMap((meal) => {
        const draft = drafts.find((item) => item.mealType === meal.mealType);
        const problem = draft ? slotProblem(meal, draft) : null;
        return problem ? [[meal.mealType, problem] as const] : [];
      });
      setProblems(Object.fromEntries(found));
      if (found[0]) {
        setExpanded(found[0][0]);
        return;
      }
      const result = await save.mutateAsync(toSaveRequest(preferences, { meals: drafts }));
      setSummary(describeSaveResult(result.changes, result.bookingsUpdated));
    });

  return (
    <Screen
      footer={
        summary ? (
          <AppButton label="Back to Default Booking" onPress={() => router.back()} />
        ) : (
          <AppButton
            label="Save and Continue Default Booking"
            isLoading={save.isPending}
            onPress={onSave}
          />
        )
      }
    >
      <Text className="mb-1 text-2xl font-bold text-foreground">Change Slots</Text>
      <Text className="mb-4 text-sm text-muted-foreground">
        Set Breakfast, Lunch and Dinner together. Only meals that are ON are booked automatically.
      </Text>
      {summary ? <MessageBanner tone="success" message={summary} /> : null}
      {save.error ? <MessageBanner message={save.error.message} /> : null}
      {preferences.meals.map((meal) => {
        const draft = drafts.find((item) => item.mealType === meal.mealType);
        if (!draft) return null;
        const isOpen = expanded === meal.mealType;
        return (
          <View key={meal.mealType} className="mb-3 rounded-lg border border-border bg-background">
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              accessibilityLabel={`${meal.mealName} settings`}
              onPress={() => setExpanded(isOpen ? null : meal.mealType)}
              className="flex-row items-center justify-between p-4"
            >
              <Text className="text-lg font-semibold text-foreground">{meal.mealName}</Text>
              <Text className="text-sm text-muted-foreground">
                {draft.isEnabled ? 'ON' : 'OFF'} {isOpen ? '▲' : '▼'}
              </Text>
            </Pressable>
            {isOpen ? (
              <View className="px-4 pb-4">
                <MealSettingsForm
                  meal={meal}
                  draft={draft}
                  error={problems[meal.mealType]}
                  onChange={(changes) => updateDraft(meal.mealType, changes)}
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </Screen>
  );
}
