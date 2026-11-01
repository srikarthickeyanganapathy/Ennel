import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { type NoShowSummary } from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import { QueryState } from '@/shared/components/QueryState';
import { Screen } from '@/shared/components/Screen';
import { formatBusinessDate } from '@/shared/utils/format-date';
import { MEAL_LABELS } from '@/features/bookings/constants/booking-labels';
import { useNoShowSummary } from '../hooks/use-no-shows';
import { eventStatusText } from '../utils/no-show-text';

/** Spec §10: counts per meal and each No-show, with "Report incorrect record". */
export function NoShowsScreen() {
  const summary = useNoShowSummary();
  return (
    <QueryState
      isLoading={summary.isLoading}
      error={summary.error}
      onRetry={() => void summary.refetch()}
      loadingLabel="Loading your No-shows"
    >
      {summary.data ? <NoShowsContent summary={summary.data} /> : null}
    </QueryState>
  );
}

function NoShowsContent({ summary }: { summary: NoShowSummary }) {
  const router = useRouter();
  return (
    <Screen>
      <Text className="mb-1 text-2xl font-bold text-foreground">No-shows</Text>
      <Text className="mb-4 text-sm text-muted-foreground">
        A No-show is a booked meal with no recorded attendance. After {summary.disableThreshold} for
        one meal in {summary.windowDays} days, Default Booking turns off for that meal.
      </Text>
      <View className="mb-6 flex-row gap-3">
        {summary.meals.map((meal) => (
          <View
            key={meal.mealType}
            className="flex-1 rounded-lg border border-border bg-background p-3"
          >
            <Text className="text-sm text-muted-foreground">{meal.mealName}</Text>
            <Text className="text-xl font-bold text-foreground">
              {meal.count} / {summary.disableThreshold}
            </Text>
            {meal.isAutoDisabled ? (
              <Text className="text-xs font-semibold text-danger">Default Booking off</Text>
            ) : meal.level === 'WARNING' ? (
              <Text className="text-xs font-semibold text-warning">Warning</Text>
            ) : null}
          </View>
        ))}
      </View>
      <Text className="mb-2 text-sm font-semibold text-foreground" accessibilityRole="header">
        Last {summary.windowDays} days
      </Text>
      {summary.events.length === 0 ? (
        <Text className="text-sm text-muted-foreground">No No-shows. Well done.</Text>
      ) : null}
      {summary.events.map((event) => (
        <View key={event.id} className="mb-3 rounded-lg border border-border bg-background p-4">
          <Text className="text-base font-semibold text-foreground">
            {formatBusinessDate(event.date)} · {MEAL_LABELS[event.mealType]}
          </Text>
          <Text className="mt-1 text-sm text-muted-foreground">{eventStatusText(event)}</Text>
          {event.canAppeal ? (
            <View className="mt-3">
              <AppButton
                label="Report incorrect record"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: '/(student)/no-shows/report/[id]',
                    params: { id: event.id },
                  })
                }
              />
            </View>
          ) : null}
        </View>
      ))}
    </Screen>
  );
}
