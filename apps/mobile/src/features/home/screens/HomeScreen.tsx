import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import {
  addBusinessDays,
  type BusinessDate,
  type DayResponse,
  type DietType,
  type MealCard,
  toBusinessDate,
} from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import { MessageBanner } from '@/shared/components/MessageBanner';
import { QueryState } from '@/shared/components/QueryState';
import { Screen } from '@/shared/components/Screen';
import { StepHeader } from '@/shared/components/StepHeader';
import { useNow } from '@/shared/hooks/use-now';
import { confirmAction } from '@/shared/utils/confirm-action';
import { describeBusinessDate } from '@/shared/utils/format-date';
import { useMyProfile } from '@/features/onboarding/hooks/use-onboarding-queries';
import { MEAL_LABELS } from '@/features/bookings/constants/booking-labels';
import {
  useCancelBooking,
  useCancelEligibleMeals,
  useChangeBooking,
  useDay,
} from '@/features/bookings/hooks/use-bookings';
import { MealCardView } from '../components/MealCardView';

/** Spec §4 Home: the student's meals for a date within the booking period. */
export function HomeScreen() {
  const [date, setDate] = useState<BusinessDate>(() => toBusinessDate(new Date()));
  const day = useDay(date);
  return (
    <QueryState
      isLoading={day.isLoading}
      error={day.error}
      onRetry={() => void day.refetch()}
      loadingLabel="Loading your meals"
    >
      {day.data ? <HomeContent day={day.data} onDateChange={setDate} /> : null}
    </QueryState>
  );
}

function HomeContent({
  day,
  onDateChange,
}: {
  day: DayResponse;
  onDateChange: (date: BusinessDate) => void;
}) {
  const router = useRouter();
  const now = useNow();
  const me = useMyProfile();
  const [notice, setNotice] = useState<string | null>(null);
  const change = useChangeBooking();
  const cancel = useCancelBooking();
  const cancelToday = useCancelEligibleMeals();
  const error = change.error ?? cancel.error ?? cancelToday.error;
  const isBusy = change.isPending || cancel.isPending || cancelToday.isPending;
  const tomorrow = addBusinessDays(day.today, 1);

  const openSlots = (card: MealCard, mode: 'book' | 'change') =>
    router.push({
      pathname: '/(student)/slot-selection',
      params:
        card.booking && mode === 'change'
          ? {
              date: day.date,
              meal: card.mealType,
              mode,
              bookingId: card.booking.id,
              version: String(card.booking.version),
              slotId: card.booking.slotId,
              dietType: card.booking.dietType,
            }
          : { date: day.date, meal: card.mealType, mode },
    });

  const changeDiet = (card: MealCard, dietType: DietType) => {
    if (!card.booking) return;
    setNotice(null);
    change.mutate(
      { bookingId: card.booking.id, body: { dietType, version: card.booking.version } },
      { onSuccess: () => setNotice(`${card.mealName} meal type changed for this date.`) },
    );
  };

  const confirmCancel = async (card: MealCard) => {
    if (!card.booking) return;
    const isConfirmed = await confirmAction({
      title: `Cancel ${card.mealName}?`,
      message: `${describeBusinessDate(day.date, day.today, tomorrow)}. You can book again while slots are open.`,
      cancelLabel: 'Keep Meal',
      confirmLabel: 'Cancel Meal',
      isDestructive: true,
    });
    if (!isConfirmed) return;
    setNotice(null);
    cancel.mutate(
      { bookingId: card.booking.id },
      { onSuccess: () => setNotice(`${card.mealName} cancelled.`) },
    );
  };

  return (
    <Screen>
      <StepHeader
        title={`Welcome, ${me.data?.fullName ?? ''}`}
        subtitle={[me.data?.blockName, me.data?.roomNumber ? `Room ${me.data.roomNumber}` : null]
          .filter(Boolean)
          .join(' • ')}
      />
      <DateSwitcher
        day={day}
        tomorrow={tomorrow}
        onDateChange={(next) => (setNotice(null), onDateChange(next))}
      />
      {notice ? <MessageBanner tone="success" message={notice} /> : null}
      {error ? <MessageBanner message={error.message} /> : null}
      {day.meals.map((card) => (
        <MealCardView
          key={card.mealType}
          card={card}
          now={now}
          isBusy={isBusy}
          onBook={() => openSlots(card, 'book')}
          onChangeSlot={() => openSlots(card, 'change')}
          onChangeDiet={(dietType) => changeDiet(card, dietType)}
          onCancel={() => void confirmCancel(card)}
        />
      ))}
      {day.date === day.today ? (
        <CancelTodayButton
          day={day}
          isBusy={isBusy}
          onCancel={() =>
            cancelToday.mutate(
              { date: day.date },
              { onSuccess: (result) => setNotice(cancelSummary(result.cancelled)) },
            )
          }
        />
      ) : null}
    </Screen>
  );
}

function DateSwitcher({
  day,
  tomorrow,
  onDateChange,
}: {
  day: DayResponse;
  tomorrow: BusinessDate;
  onDateChange: (date: BusinessDate) => void;
}) {
  return (
    <View className="mb-4">
      <Text className="text-base font-semibold text-foreground" accessibilityRole="header">
        {describeBusinessDate(day.date, day.today, tomorrow)}
      </Text>
      {day.date !== day.today ? (
        <Text className="text-sm text-info">You are viewing a future date.</Text>
      ) : null}
      <View className="mt-2 flex-row gap-3">
        <View className="flex-1">
          <AppButton
            label="Previous Day"
            variant="secondary"
            onPress={() => onDateChange(addBusinessDays(day.date, -1))}
            isDisabled={day.date <= day.today}
          />
        </View>
        <View className="flex-1">
          <AppButton
            label="Next Day"
            variant="secondary"
            onPress={() => onDateChange(addBusinessDays(day.date, 1))}
            isDisabled={day.date >= day.lastBookableDate}
          />
        </View>
      </View>
    </View>
  );
}

/** Spec §4.4: confirm with a summary of which meals can still be cancelled. */
function CancelTodayButton({
  day,
  isBusy,
  onCancel,
}: {
  day: DayResponse;
  isBusy: boolean;
  onCancel: () => void;
}) {
  const booked = day.meals.filter((meal) => meal.booking?.status === 'BOOKED');
  if (booked.length === 0) return null;
  const eligible = booked.filter((meal) => meal.actions.cancel.allowed);
  const confirm = async () => {
    const closed = booked
      .filter((meal) => !meal.actions.cancel.allowed)
      .map((meal) => `${meal.mealName}: ${meal.actions.cancel.reason ?? 'closed'}`);
    const isConfirmed = await confirmAction({
      title: "Cancel today's meals?",
      message: [
        eligible.length > 0
          ? `Will be cancelled: ${eligible.map((meal) => meal.mealName).join(', ')}.`
          : 'No meal can still be cancelled today.',
        ...closed,
      ].join('\n'),
      cancelLabel: 'Keep Meals',
      confirmLabel: 'Cancel Eligible Meals',
      isDestructive: true,
    });
    if (isConfirmed && eligible.length > 0) onCancel();
  };
  return (
    <View className="mb-6">
      <AppButton
        label="Cancel Today's Meals"
        variant="danger"
        onPress={() => void confirm()}
        isDisabled={isBusy}
      />
    </View>
  );
}

function cancelSummary(cancelled: MealCard['mealType'][]): string {
  if (cancelled.length === 0) return 'No meals could be cancelled.';
  return `Cancelled: ${cancelled.map((meal) => MEAL_LABELS[meal]).join(', ')}.`;
}
