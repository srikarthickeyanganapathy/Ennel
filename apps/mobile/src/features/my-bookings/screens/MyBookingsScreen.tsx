import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  addBusinessDays,
  type BookingHistoryItem,
  type BusinessDate,
  HISTORY_STATUS_FILTERS,
  type HistoryStatusFilter,
  type MealType,
  toBusinessDate,
} from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import { MessageBanner } from '@/shared/components/MessageBanner';
import { MonthCalendar } from '@/shared/components/MonthCalendar';
import { Screen } from '@/shared/components/Screen';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import { monthOf } from '@/shared/utils/calendar';
import { formatBusinessDate } from '@/shared/utils/format-date';
import { DIET_LABELS, MEAL_LABELS } from '@/features/bookings/constants/booking-labels';
import { HISTORY_STATUS_DISPLAY, STATUS_FILTER_LABELS } from '../constants/history-display';
import { useBookingHistory } from '../hooks/use-booking-history';
import { describeOutcome, type RangeChoice, rangeFor } from '../utils/history-text';

const ALL = 'ALL';
const MEAL_OPTIONS = [
  { value: ALL, label: 'All' },
  ...(['BREAKFAST', 'LUNCH', 'DINNER'] as const).map((meal) => ({
    value: meal,
    label: MEAL_LABELS[meal],
  })),
];
const STATUS_OPTIONS = [
  { value: ALL, label: 'All' },
  ...HISTORY_STATUS_FILTERS.map((status) => ({
    value: status,
    label: STATUS_FILTER_LABELS[status],
  })),
];
const RANGE_OPTIONS = [
  { value: 'RECENT', label: 'Recent' },
  { value: 'LAST_7', label: 'Last 7 days' },
  { value: 'DATE', label: 'Pick a date' },
];

/** Spec §7 My Bookings: final records with date, meal and status filters. */
export function MyBookingsScreen() {
  const router = useRouter();
  const today = toBusinessDate(new Date());
  const [range, setRange] = useState<RangeChoice>('RECENT');
  const [date, setDate] = useState<BusinessDate | null>(null);
  const [month, setMonth] = useState(() => monthOf(today));
  const [meal, setMeal] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const history = useBookingHistory({
    ...rangeFor(range, today, date),
    mealType: meal === ALL ? undefined : (meal as MealType),
    status: status === ALL ? undefined : (status as HistoryStatusFilter),
  });
  const items = history.data?.pages.flatMap((page) => page.items) ?? [];
  const isPickingDate = range === 'DATE' && !date;

  return (
    <Screen>
      <Text className="mb-1 text-2xl font-bold text-foreground">My Bookings</Text>
      <Text className="mb-4 text-sm text-muted-foreground">
        Completed, cancelled and No-show meals. Upcoming meals stay on Home.
      </Text>
      <SegmentedControl
        label="Dates"
        options={RANGE_OPTIONS}
        selected={range}
        onSelect={(value) => (setRange(value as RangeChoice), setDate(null))}
      />
      {range === 'DATE' && date ? (
        <Pressable accessibilityRole="button" onPress={() => setDate(null)} className="mb-2 py-1">
          <Text className="text-sm text-primary">
            Showing {formatBusinessDate(date)} · Change date
          </Text>
        </Pressable>
      ) : null}
      {isPickingDate ? (
        <View className="mb-3">
          <MonthCalendar
            month={month}
            onMonthChange={setMonth}
            bounds={{
              firstDate: addBusinessDays(today, -365),
              lastDate: addBusinessDays(today, 30),
              today,
            }}
            selected={date}
            onSelect={setDate}
          />
        </View>
      ) : null}
      <SegmentedControl label="Meal" options={MEAL_OPTIONS} selected={meal} onSelect={setMeal} />
      <SegmentedControl
        label="Status"
        options={STATUS_OPTIONS}
        selected={status}
        onSelect={setStatus}
      />

      <View className="mt-3">
        {history.error ? <MessageBanner message={history.error.message} /> : null}
        {history.isLoading && !isPickingDate ? (
          <Text className="text-sm text-muted-foreground">Loading your meals…</Text>
        ) : null}
        {!history.isLoading && !isPickingDate && items.length === 0 && !history.error ? (
          <Text className="text-sm text-muted-foreground">No meals match these filters.</Text>
        ) : null}
        {isPickingDate
          ? null
          : items.map((item) => (
              <HistoryRow
                key={item.id}
                item={item}
                onOpen={() =>
                  router.push({
                    pathname: '/(student)/booking-record/[id]',
                    params: { id: item.id },
                  })
                }
              />
            ))}
        {history.hasNextPage && !isPickingDate ? (
          <AppButton
            label="Load more"
            variant="secondary"
            isLoading={history.isFetchingNextPage}
            onPress={() => void history.fetchNextPage()}
          />
        ) : null}
      </View>
      <View className="mb-6 mt-4">
        <AppButton
          label="Back to Home"
          variant="secondary"
          onPress={() => router.navigate('/(tabs)')}
        />
      </View>
    </Screen>
  );
}

function HistoryRow({ item, onOpen }: { item: BookingHistoryItem; onOpen: () => void }) {
  const display = HISTORY_STATUS_DISPLAY[item.status];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.mealName} on ${formatBusinessDate(item.date)}, ${display.text}. View details`}
      onPress={onOpen}
      className="mb-3 rounded-lg border border-border bg-background p-4"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-foreground">
          {formatBusinessDate(item.date)} · {item.mealName}
        </Text>
        <Text className={`rounded px-2 py-0.5 text-xs font-semibold ${display.badgeClassName}`}>
          {display.text}
        </Text>
      </View>
      <Text className="mt-1 text-sm text-foreground">
        {item.slotLabel} · {DIET_LABELS[item.dietType]}
      </Text>
      <Text className="mt-1 text-xs text-muted-foreground">{describeOutcome(item)}</Text>
      <Text className="mt-2 text-sm font-semibold text-primary">View Details ›</Text>
    </Pressable>
  );
}
