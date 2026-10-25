import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { addBusinessDays, type DayResponse, type DietType, type MealCard } from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import { MessageBanner } from '@/shared/components/MessageBanner';
import { useNow } from '@/shared/hooks/use-now';
import { confirmAction } from '@/shared/utils/confirm-action';
import { describeBusinessDate } from '@/shared/utils/format-date';
import { MEAL_LABELS } from '@/features/bookings/constants/booking-labels';
import {
  useCancelBooking,
  useCancelEligibleMeals,
  useChangeBooking,
} from '@/features/bookings/hooks/use-bookings';
import { MealCardView } from './MealCardView';

/**
 * One date's meal cards with book, change and cancel (Spec §4). Shared by Home and the Plan
 * Ahead date view (Spec §6.1), so a change from either affects only that date. Give it a
 * `key` per date so its notices reset when the date changes.
 */
export function DayMeals({ day }: { day: DayResponse }) {
  const router = useRouter();
  const now = useNow();
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
    <View>
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
