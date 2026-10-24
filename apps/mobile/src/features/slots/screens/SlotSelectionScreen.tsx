import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { z } from 'zod';
import {
  addBusinessDays,
  dietTypeSchema,
  type DietType,
  formatMinuteOfDay,
  slotAvailabilityQuerySchema,
  type SlotAvailability,
  type SlotAvailabilityResponse,
  toBusinessDate,
  toMinuteOfDay,
} from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import { MessageBanner } from '@/shared/components/MessageBanner';
import { QueryState } from '@/shared/components/QueryState';
import { Screen } from '@/shared/components/Screen';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import { StepHeader } from '@/shared/components/StepHeader';
import { useSubmitLock } from '@/shared/hooks/use-submit-lock';
import { describeBusinessDate } from '@/shared/utils/format-date';
import { DIET_LABELS } from '@/features/bookings/constants/booking-labels';
import { useBookMeal, useChangeBooking } from '@/features/bookings/hooks/use-bookings';
import { SlotCard } from '../components/SlotCard';
import { useSlotAvailability } from '../hooks/use-slot-availability';

/** Route params: Book opens with date + meal; Change Slot adds the current booking. */
const paramsSchema = slotAvailabilityQuerySchema.extend({
  mode: z.enum(['view', 'book', 'change']).default('view'),
  bookingId: z.uuid().optional(),
  version: z.coerce.number().int().optional(),
  slotId: z.uuid().optional(),
  dietType: dietTypeSchema.optional(),
});
type Params = z.output<typeof paramsSchema>;

const DIET_OPTIONS = [
  { value: 'VEG', label: DIET_LABELS.VEG },
  { value: 'NON_VEG', label: DIET_LABELS.NON_VEG },
];

/** Spec §5 Slot Selection, shared by Book Meal and Change Slot. */
export function SlotSelectionScreen() {
  const parsed = paramsSchema.safeParse(useLocalSearchParams());
  const isValid =
    parsed.success &&
    (parsed.data.mode !== 'change' || (parsed.data.bookingId && parsed.data.version));
  if (!parsed.success || !isValid) {
    return (
      <Screen>
        <MessageBanner message="This meal or date could not be opened. Go back and try again." />
      </Screen>
    );
  }
  return <SlotLoader params={parsed.data} />;
}

function SlotLoader({ params }: { params: Params }) {
  const availability = useSlotAvailability(params.date, params.meal);
  return (
    <QueryState
      isLoading={availability.isLoading}
      error={availability.error}
      onRetry={() => void availability.refetch()}
      loadingLabel="Loading slots"
    >
      {availability.data ? (
        <SlotPicker
          data={availability.data}
          params={params}
          isRefreshing={availability.isFetching}
        />
      ) : null}
    </QueryState>
  );
}

function SlotPicker({
  data,
  params,
  isRefreshing,
}: {
  data: SlotAvailabilityResponse;
  params: Params;
  isRefreshing: boolean;
}) {
  const router = useRouter();
  const isChoosing = params.mode !== 'view';
  // Breakfast has one serving window, so it is chosen for the student (Spec §4.3).
  const [slotId, setSlotId] = useState<string | undefined>(
    params.slotId ?? (data.slots.length === 1 ? data.slots[0]?.slotId : undefined),
  );
  const [dietType, setDietType] = useState<DietType>(params.dietType ?? 'VEG');
  const book = useBookMeal();
  const change = useChangeBooking();
  const lock = useSubmitLock();
  const mutation = params.mode === 'change' ? change : book;
  const hasChanges =
    params.mode !== 'change' || slotId !== params.slotId || dietType !== params.dietType;

  const confirm = () =>
    lock(async () => {
      if (!slotId) return;
      if (params.mode === 'change' && params.bookingId && params.version) {
        const body = {
          version: params.version,
          ...(slotId !== params.slotId && { slotId }),
          ...(dietType !== params.dietType && { dietType }),
        };
        await change.mutateAsync({ bookingId: params.bookingId, body });
      } else {
        await book.mutateAsync({ date: data.date, mealType: data.mealType, slotId, dietType });
      }
      router.back();
    });

  return (
    <Screen
      footer={
        isChoosing ? (
          <AppButton
            label={params.mode === 'change' ? 'Save Changes' : 'Confirm Slot'}
            onPress={confirm}
            isLoading={mutation.isPending}
            isDisabled={!slotId || !hasChanges || data.isClosed}
          />
        ) : (
          <DayButtons data={data} />
        )
      }
    >
      <Header data={data} isRefreshing={isRefreshing} />
      {mutation.error ? <MessageBanner message={mutation.error.message} /> : null}
      {data.slots.length === 0 ? (
        <MessageBanner
          tone="info"
          message="No slots are open for this meal yet. Please check with the mess office."
        />
      ) : (
        data.slots.map((slot) => (
          <SlotCard
            key={slot.slotId}
            slot={choosable(slot, params.slotId)}
            isSelected={isChoosing && slot.slotId === slotId}
            onSelect={isChoosing ? setSlotId : undefined}
          />
        ))
      )}
      {isChoosing ? (
        <View className="mt-2">
          <SegmentedControl
            label="Meal type"
            options={DIET_OPTIONS}
            selected={dietType}
            onSelect={(value) => setDietType(value as DietType)}
          />
          <Text className="text-sm text-muted-foreground">
            {params.mode === 'change'
              ? 'Changes apply to this date only.'
              : 'Subject to the menu on the day.'}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

/** The student's current slot stays selectable in Change Slot even if it is now full. */
function choosable(slot: SlotAvailability, currentSlotId: string | undefined): SlotAvailability {
  return slot.slotId === currentSlotId && slot.unavailableReason === 'FULL'
    ? { ...slot, canSelect: true, unavailableReason: null }
    : slot;
}

function Header({ data, isRefreshing }: { data: SlotAvailabilityResponse; isRefreshing: boolean }) {
  const today = toBusinessDate(new Date(data.generatedAt));
  const window = `${formatMinuteOfDay(data.serviceStartMinute)} – ${formatMinuteOfDay(data.serviceEndMinute)}`;
  return (
    <>
      <StepHeader
        title={`${data.mealName} slots`}
        subtitle={describeBusinessDate(data.date, today, addBusinessDays(today, 1))}
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
    </>
  );
}

function DayButtons({ data }: { data: SlotAvailabilityResponse }) {
  const router = useRouter();
  const today = toBusinessDate(new Date(data.generatedAt));
  const goTo = (days: number) => router.setParams({ date: addBusinessDays(data.date, days) });
  return (
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
  );
}
