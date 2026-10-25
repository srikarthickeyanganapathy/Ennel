import { useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { addBusinessDays, businessDateSchema } from '@ennel/shared';
import { MessageBanner } from '@/shared/components/MessageBanner';
import { QueryState } from '@/shared/components/QueryState';
import { Screen } from '@/shared/components/Screen';
import { describeBusinessDate } from '@/shared/utils/format-date';
import { useDay } from '@/features/bookings/hooks/use-bookings';
import { DayMeals } from '@/features/home/components/DayMeals';

/** Spec §6.1: the same meal cards as Home for one chosen date, with the date shown clearly. */
export function PlanAheadDayScreen() {
  const { date: param } = useLocalSearchParams<{ date?: string }>();
  const date = businessDateSchema.safeParse(param);
  if (!date.success) {
    return (
      <Screen>
        <MessageBanner message="Choose a date from Plan Ahead." />
      </Screen>
    );
  }
  return <DayView date={date.data} />;
}

function DayView({ date }: { date: string }) {
  const day = useDay(date);
  return (
    <QueryState
      isLoading={day.isLoading}
      error={day.error}
      onRetry={() => void day.refetch()}
      loadingLabel="Loading meals for this date"
    >
      {day.data ? (
        <Screen>
          <Text className="text-sm font-medium text-muted-foreground">Plan Ahead</Text>
          <Text className="mb-1 text-2xl font-bold text-foreground" accessibilityRole="header">
            {describeBusinessDate(
              day.data.date,
              day.data.today,
              addBusinessDays(day.data.today, 1),
            )}
          </Text>
          <Text className="mb-4 text-sm text-info">
            Changes here apply to this date only. Your Default Booking and weekday rules stay the
            same.
          </Text>
          <DayMeals key={day.data.date} day={day.data} />
        </Screen>
      ) : null}
    </QueryState>
  );
}
