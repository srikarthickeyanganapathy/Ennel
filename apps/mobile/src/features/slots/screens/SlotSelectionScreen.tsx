import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import {
  addBusinessDays,
  formatMinuteOfDay,
  type MealType,
  slotAvailabilityQuerySchema,
  type SlotAvailabilityResponse,
  toBusinessDate,
  toMinuteOfDay,
} from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import { MessageBanner } from '@/shared/components/MessageBanner';
import { QueryState } from '@/shared/components/QueryState';
import { Screen } from '@/shared/components/Screen';
import { StepHeader } from '@/shared/components/StepHeader';
import { describeBusinessDate } from '@/shared/utils/format-date';
import { SlotCard } from '../components/SlotCard';
import { useSlotAvailability } from '../hooks/use-slot-availability';

/**
 * Spec §5 Slot Selection. Phase 3 shows live availability; choosing and confirming a slot
 * (Book Meal / Change Slot) is wired to the booking engine in Phase 4.
 */
export function SlotSelectionScreen() {
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const parsed = slotAvailabilityQuerySchema.safeParse(params);
  if (!parsed.success) {
    return (
      <Screen>
        <MessageBanner message="This meal or date could not be opened. Go back and try again." />
      </Screen>
    );
  }
  return <SlotAvailabilityView date={parsed.data.date} meal={parsed.data.meal} />;
}

function SlotAvailabilityView({ date, meal }: { date: string; meal: MealType }) {
  const availability = useSlotAvailability(date, meal);
  return (
    <QueryState
      isLoading={availability.isLoading}
      error={availability.error}
      onRetry={() => void availability.refetch()}
      loadingLabel="Loading slots"
    >
      {availability.data ? (
        <AvailabilityContent data={availability.data} isRefreshing={availability.isFetching} />
      ) : null}
    </QueryState>
  );
}

function AvailabilityContent({
  data,
  isRefreshing,
}: {
  data: SlotAvailabilityResponse;
  isRefreshing: boolean;
}) {
  const router = useRouter();
  const today = toBusinessDate(new Date(data.generatedAt));
  const tomorrow = addBusinessDays(today, 1);
  const goTo = (days: number) => router.setParams({ date: addBusinessDays(data.date, days) });
  const window = `${formatMinuteOfDay(data.serviceStartMinute)} – ${formatMinuteOfDay(data.serviceEndMinute)}`;

  return (
    <Screen
      footer={
        <View className="flex-row gap-3">
          <View className="flex-1">
            <AppButton
              label="Previous Day"
              variant="secondary"
              onPress={() => goTo(-1)}
              isDisabled={data.date <= today}
            />
          </View>
          <View className="flex-1">
            <AppButton
              label="Next Day"
              variant="secondary"
              onPress={() => goTo(1)}
              isDisabled={data.date >= data.lastBookableDate}
            />
          </View>
        </View>
      }
    >
      <StepHeader
        title={`${data.mealName} slots`}
        subtitle={describeBusinessDate(data.date, today, tomorrow)}
      />
      <Text className="mb-4 text-sm text-muted-foreground">
        Serving {window}
        {data.slots.length === 1 ? ' · one serving window' : ''}
        {isRefreshing
          ? ' · Updating…'
          : ` · Updated ${formatMinuteOfDay(toMinuteOfDay(new Date(data.generatedAt)))}`}
      </Text>
      {data.isClosed ? (
        <MessageBanner
          message={`The mess is closed for ${data.mealName.toLowerCase()} on this day${data.closureTitle ? `: ${data.closureTitle}` : ''}.`}
        />
      ) : null}
      {data.slots.length === 0 ? (
        <MessageBanner
          tone="info"
          message="No slots are open for this meal yet. Please check with the mess office."
        />
      ) : (
        data.slots.map((slot) => <SlotCard key={slot.slotId} slot={slot} />)
      )}
      <Text className="mt-2 text-sm text-muted-foreground">
        Counts refresh automatically. Booking a slot from this screen is coming soon.
      </Text>
    </Screen>
  );
}
