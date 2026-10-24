import { Text, View } from 'react-native';
import { type DietType, formatMinuteOfDay, type MealAction, type MealCard } from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import { formatTimeLeft } from '@/shared/utils/format-countdown';
import { BOOKING_LABEL_DISPLAY, DIET_LABELS } from '@/features/bookings/constants/booking-labels';

interface MealCardViewProps {
  card: MealCard;
  now: Date;
  isBusy: boolean;
  onBook: () => void;
  onChangeSlot: () => void;
  onChangeDiet: (dietType: DietType) => void;
  onCancel: () => void;
}

const DIET_OPTIONS = [
  { value: 'VEG', label: DIET_LABELS.VEG },
  { value: 'NON_VEG', label: DIET_LABELS.NON_VEG },
];

/** Spec §4.2–4.5 meal card: status, slot, meal type, actions, countdowns and reasons. */
export function MealCardView({ card, now, isBusy, ...handlers }: MealCardViewProps) {
  const label = BOOKING_LABEL_DISPLAY[card.label];
  const { booking, actions } = card;
  return (
    <View
      className="mb-4 rounded-lg border border-border bg-background p-4"
      accessibilityLabel={`${card.mealName}, ${label.text}`}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-foreground">{card.mealName}</Text>
        <Text
          className={`overflow-hidden rounded-full px-2 py-0.5 text-xs font-semibold ${label.badgeClassName}`}
        >
          {label.text}
        </Text>
      </View>
      <Text className="mt-1 text-sm text-muted-foreground">{whenText(card)}</Text>
      <Notes card={card} />
      {booking && actions.changeDiet.allowed ? (
        <View className="mt-3">
          <SegmentedControl
            label="Meal type (this date only)"
            options={DIET_OPTIONS}
            selected={booking.dietType}
            onSelect={(value) =>
              value !== booking.dietType && handlers.onChangeDiet(value as DietType)
            }
          />
        </View>
      ) : null}
      <Actions card={card} isBusy={isBusy} {...handlers} />
      <Countdown action={actions.cancel} now={now} text="Cancellation closes in" />
      <Countdown action={actions.changeSlot} now={now} text="Slot change closes in" />
      <Reason action={actions.book} />
      <Reason action={actions.cancel} />
    </View>
  );
}

function whenText(card: MealCard): string {
  if (card.booking) {
    const slot = `${formatMinuteOfDay(card.booking.slotStartMinute)} – ${formatMinuteOfDay(card.booking.slotEndMinute)}`;
    return `${slot} · Meal type: ${DIET_LABELS[card.booking.dietType]}`;
  }
  return `Serving ${formatMinuteOfDay(card.serviceStartMinute)} – ${formatMinuteOfDay(card.serviceEndMinute)}`;
}

function Notes({ card }: { card: MealCard }) {
  return (
    <>
      {card.closureTitle ? (
        <Text className="mt-2 text-sm text-warning">Mess closed: {card.closureTitle}</Text>
      ) : null}
      {card.booking?.isUpdatedByStaff ? (
        <Text className="mt-2 text-sm text-info">Updated by mess staff</Text>
      ) : null}
      {card.booking?.isOverCapacity ? (
        <Text className="mt-2 text-sm text-foreground">
          Booked above official capacity under the mess policy.
        </Text>
      ) : null}
    </>
  );
}

function Actions({
  card,
  isBusy,
  onBook,
  onChangeSlot,
  onCancel,
}: Omit<MealCardViewProps, 'now' | 'onChangeDiet'>) {
  const { actions } = card;
  if (actions.book.allowed) {
    return (
      <View className="mt-3">
        <AppButton label={`Book ${card.mealName}`} onPress={onBook} isDisabled={isBusy} />
      </View>
    );
  }
  if (!card.booking || card.booking.status !== 'BOOKED') return null;
  return (
    <View className="mt-3 flex-row gap-3">
      <View className="flex-1">
        <AppButton
          label="Change Slot"
          variant="secondary"
          onPress={onChangeSlot}
          isDisabled={isBusy || !actions.changeSlot.allowed}
        />
      </View>
      <View className="flex-1">
        <AppButton
          label="Cancel"
          variant="danger"
          onPress={onCancel}
          isDisabled={isBusy || !actions.cancel.allowed}
        />
      </View>
    </View>
  );
}

function Countdown({ action, now, text }: { action: MealAction; now: Date; text: string }) {
  const left = action.allowed && action.deadlineAt ? formatTimeLeft(action.deadlineAt, now) : null;
  return left ? (
    <Text className="mt-2 text-sm text-muted-foreground">
      {text} {left}.
    </Text>
  ) : null;
}

function Reason({ action }: { action: MealAction }) {
  return action.reason ? (
    <Text className="mt-2 text-sm text-foreground">{action.reason}</Text>
  ) : null;
}
