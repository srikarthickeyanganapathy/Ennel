import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { type BusinessDate, toBusinessDate } from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import { MonthCalendar } from '@/shared/components/MonthCalendar';
import { QueryState } from '@/shared/components/QueryState';
import { Screen } from '@/shared/components/Screen';
import { monthOf } from '@/shared/utils/calendar';
import { formatBusinessDate } from '@/shared/utils/format-date';
import { useDay } from '@/features/bookings/hooks/use-bookings';

/** Spec §6.1 "Choose a Date": a month calendar limited to the booking period. */
export function PlanAheadCalendarScreen() {
  const today = toBusinessDate(new Date());
  // Today's day response carries the last bookable date (BR-DEAD booking horizon).
  const day = useDay(today);
  return (
    <QueryState
      isLoading={day.isLoading}
      error={day.error}
      onRetry={() => void day.refetch()}
      loadingLabel="Loading the calendar"
    >
      {day.data ? (
        <CalendarContent today={day.data.today} lastDate={day.data.lastBookableDate} />
      ) : null}
    </QueryState>
  );
}

function CalendarContent({ today, lastDate }: { today: BusinessDate; lastDate: BusinessDate }) {
  const router = useRouter();
  const [month, setMonth] = useState(() => monthOf(today));
  const [selected, setSelected] = useState<BusinessDate | null>(null);

  return (
    <Screen
      footer={
        <AppButton
          label={selected ? `Select ${formatBusinessDate(selected)}` : 'Select date'}
          isDisabled={!selected}
          onPress={() =>
            selected &&
            router.push({ pathname: '/(student)/plan-ahead/day', params: { date: selected } })
          }
        />
      }
    >
      <Text className="mb-1 text-2xl font-bold text-foreground">Choose a Date</Text>
      <Text className="mb-4 text-sm text-muted-foreground">
        You can plan from today to {formatBusinessDate(lastDate)}.
      </Text>
      <MonthCalendar
        month={month}
        onMonthChange={setMonth}
        bounds={{ firstDate: today, lastDate, today }}
        selected={selected}
        onSelect={setSelected}
      />
    </Screen>
  );
}
