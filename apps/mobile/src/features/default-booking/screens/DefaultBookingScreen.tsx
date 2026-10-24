import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  type DefaultPreferences,
  type MealType,
  type SaveDefaultPreferencesResponse,
} from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import { MessageBanner } from '@/shared/components/MessageBanner';
import { QueryState } from '@/shared/components/QueryState';
import { Screen } from '@/shared/components/Screen';
import { ToggleRow } from '@/shared/components/ToggleRow';
import { useSubmitLock } from '@/shared/hooks/use-submit-lock';
import { confirmAction } from '@/shared/utils/confirm-action';
import { DefaultMealCard } from '../components/DefaultMealCard';
import {
  useDefaultPreferences,
  useSaveDefaultPreferences,
  useUpdateMealPreference,
} from '../hooks/use-default-preferences';
import {
  describeSaveResult,
  FALLBACK_TEXT,
  HOW_IT_WORKS_TEXT,
  toSaveRequest,
} from '../utils/default-booking-text';

type Notice = { tone: 'success' | 'error'; message: string };

/** Spec §8: the overall switch, one card per meal, and the full-slot rule. */
export function DefaultBookingScreen() {
  const preferences = useDefaultPreferences();
  return (
    <QueryState
      isLoading={preferences.isLoading}
      error={preferences.error}
      onRetry={preferences.refetch}
      loadingLabel="Loading Default Booking"
    >
      {preferences.data ? <DefaultBookingContent preferences={preferences.data} /> : null}
    </QueryState>
  );
}

function DefaultBookingContent({ preferences }: { preferences: DefaultPreferences }) {
  const router = useRouter();
  const saveAll = useSaveDefaultPreferences();
  const updateMeal = useUpdateMealPreference();
  const runOnce = useSubmitLock();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const isSaving = saveAll.isPending || updateMeal.isPending;

  // Every save ends with the Spec §8.3 summary of what changed, or the reason it failed.
  const saveAndReport = async (save: () => Promise<SaveDefaultPreferencesResponse>) => {
    setNotice(null);
    try {
      const result = await save();
      setNotice({
        tone: 'success',
        message: describeSaveResult(result.changes, result.bookingsUpdated),
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not save. Please try again.',
      });
    }
  };

  const onOverallChange = (isEnabled: boolean) =>
    runOnce(async () => {
      if (!isEnabled) {
        const isConfirmed = await confirmAction({
          title: 'Pause Default Booking?',
          message:
            'No meals will be booked automatically. Upcoming automatic bookings that can still be changed are cancelled. Your meal choices are kept.',
          cancelLabel: 'Keep ON',
          confirmLabel: 'Turn OFF',
          isDestructive: true,
        });
        if (!isConfirmed) return;
      }
      await saveAndReport(() =>
        saveAll.mutateAsync(toSaveRequest(preferences, { defaultBookingEnabled: isEnabled })),
      );
    });

  const onMealToggle = (mealType: MealType, isEnabled: boolean) =>
    runOnce(() => saveAndReport(() => updateMeal.mutateAsync({ mealType, body: { isEnabled } })));

  return (
    <Screen
      footer={
        <AppButton
          label="Change Slots"
          variant="secondary"
          isDisabled={isSaving}
          onPress={() => router.push('/(student)/change-slots')}
        />
      }
    >
      <Text className="mb-1 text-2xl font-bold text-foreground">Default Booking</Text>
      <Text className="mb-4 text-sm text-muted-foreground">
        Your recurring meal bookings. Only meals that are ON are booked automatically.
      </Text>
      {notice ? <MessageBanner tone={notice.tone} message={notice.message} /> : null}
      <View className="rounded-lg border border-border bg-mint px-4">
        <ToggleRow
          label="Default Booking"
          description={
            preferences.defaultBookingEnabled
              ? 'Meals that are ON below are booked for you.'
              : 'Paused for all meals. Your choices below are kept.'
          }
          value={preferences.defaultBookingEnabled}
          onChange={onOverallChange}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isInfoOpen }}
        onPress={() => setIsInfoOpen((open) => !open)}
        className="mb-4 mt-2 flex-row items-center py-2"
      >
        <Text className="mr-2 h-5 w-5 rounded-full border border-info text-center text-xs font-bold text-info">
          i
        </Text>
        <Text className="text-sm font-medium text-info">How Default Booking works</Text>
      </Pressable>
      {isInfoOpen ? (
        <Text className="mb-4 text-sm text-foreground">{HOW_IT_WORKS_TEXT}</Text>
      ) : null}
      <Text className="mb-3 text-sm font-semibold text-foreground">Current default slots</Text>
      {preferences.meals.map((meal) => (
        <DefaultMealCard
          key={meal.mealType}
          meal={meal}
          isPaused={!preferences.defaultBookingEnabled}
          isSaving={isSaving}
          onToggle={(isEnabled) => onMealToggle(meal.mealType, isEnabled)}
          onOpen={() =>
            router.push({
              pathname: '/(student)/default-meal/[meal]',
              params: { meal: meal.mealType },
            })
          }
        />
      ))}
      <View className="mt-2 rounded-md bg-surface p-3">
        <Text className="text-sm font-semibold text-foreground">If your slot is full</Text>
        <Text className="text-sm text-muted-foreground">
          {FALLBACK_TEXT[preferences.fallbackPolicy]}
        </Text>
      </View>
    </Screen>
  );
}
