import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { type BusinessDate, toBusinessDate } from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import { QueryState } from '@/shared/components/QueryState';
import { Screen } from '@/shared/components/Screen';
import { formatBusinessDate } from '@/shared/utils/format-date';
import { useDay } from '@/features/bookings/hooks/use-bookings';
import { buildMonth, type CalendarCell, monthOf, monthTitle, shiftMonth } from '../utils/calendar';
import { WEEKDAY_SHORT } from '../utils/weekdays';

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
  const weeks = buildMonth(month, { today, lastDate });

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
      <View className="mb-3 flex-row items-center justify-between">
        <AppButton
          label="‹ Previous"
          variant="secondary"
          isDisabled={month <= monthOf(today)}
          onPress={() => setMonth(shiftMonth(month, -1))}
        />
        <Text className="text-base font-semibold text-foreground" accessibilityRole="header">
          {monthTitle(month)}
        </Text>
        <AppButton
          label="Next ›"
          variant="secondary"
          isDisabled={month >= monthOf(lastDate)}
          onPress={() => setMonth(shiftMonth(month, 1))}
        />
      </View>
      <View className="flex-row">
        {WEEKDAY_SHORT.map((name) => (
          <Text key={name} className="flex-1 text-center text-xs font-medium text-muted-foreground">
            {name}
          </Text>
        ))}
      </View>
      {weeks.map((week, index) => (
        <View key={`${month}-${index}`} className="flex-row">
          {week.map((cell, column) =>
            cell ? (
              <DayCell
                key={cell.date}
                cell={cell}
                isSelected={cell.date === selected}
                onSelect={() => setSelected(cell.date)}
              />
            ) : (
              <View key={`empty-${column}`} className="h-12 flex-1" />
            ),
          )}
        </View>
      ))}
    </Screen>
  );
}

function DayCell({
  cell,
  isSelected,
  onSelect,
}: {
  cell: CalendarCell;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const tone = isSelected ? 'bg-primary' : cell.isToday ? 'border border-primary' : '';
  const text = isSelected
    ? 'font-semibold text-primary-foreground'
    : cell.isSelectable
      ? 'text-foreground'
      : 'text-muted-foreground opacity-50';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${formatBusinessDate(cell.date)}${cell.isToday ? ', today' : ''}`}
      accessibilityState={{ disabled: !cell.isSelectable, selected: isSelected }}
      disabled={!cell.isSelectable}
      onPress={onSelect}
      className={`m-0.5 h-12 flex-1 items-center justify-center rounded-md ${tone}`}
    >
      <Text className={`text-base ${text}`}>{cell.dayOfMonth}</Text>
    </Pressable>
  );
}
