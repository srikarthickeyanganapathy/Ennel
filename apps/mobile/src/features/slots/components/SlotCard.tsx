import { Pressable, Text, View } from 'react-native';
import { type SlotAvailability } from '@ennel/shared';
import {
  CLOSED_STATUS_DISPLAY,
  OVER_CAPACITY_NOTICE,
  RECOMMENDED_DISPLAY,
  STATUS_DISPLAY,
  UNAVAILABLE_REASON_TEXT,
} from '../constants/availability-display';

interface SlotCardProps {
  slot: SlotAvailability;
  isSelected?: boolean;
  /** Omit to show the card as information only. */
  onSelect?: (slotId: string) => void;
}

/** Spec §5.1 slot card: label, availability, booked / capacity and occupancy. */
export function SlotCard({ slot, isSelected = false, onSelect }: SlotCardProps) {
  const reason = slot.unavailableReason;
  const status =
    reason === 'STARTED' || reason === 'CLOSED'
      ? CLOSED_STATUS_DISPLAY[reason]
      : STATUS_DISPLAY[slot.status];
  const isAtCapacity = slot.bookedCount >= slot.officialCapacity;
  const note = slot.unavailableReason
    ? UNAVAILABLE_REASON_TEXT[slot.unavailableReason]
    : isAtCapacity
      ? OVER_CAPACITY_NOTICE
      : null;
  const isInteractive = Boolean(onSelect) && slot.canSelect;
  const summary = `${slot.label}. ${status.label}${slot.isRecommended ? ', Recommended' : ''}. ${slot.bookedCount} of ${slot.officialCapacity} booked.${note ? ` ${note}` : ''}`;

  return (
    <Pressable
      accessibilityRole={onSelect ? 'radio' : 'text'}
      accessibilityLabel={summary}
      accessibilityState={
        onSelect
          ? { selected: isSelected, checked: isSelected, disabled: !slot.canSelect }
          : undefined
      }
      disabled={!isInteractive}
      onPress={() => onSelect?.(slot.slotId)}
      className={`mb-3 rounded-lg border p-4 ${isSelected ? 'border-2 border-primary bg-mint' : 'border-border bg-background'} ${slot.canSelect ? '' : 'opacity-60'}`}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-foreground">{slot.label}</Text>
        <View className="flex-row gap-2">
          {slot.isRecommended ? <Badge {...RECOMMENDED_DISPLAY} /> : null}
          <Badge {...status} />
        </View>
      </View>
      <Text className="mt-2 text-sm text-muted-foreground">
        {slot.bookedCount} / {slot.officialCapacity} booked · {slot.occupancyPct}% full
        {slot.overCapacityCount > 0 ? ` · +${slot.overCapacityCount} over capacity` : ''}
      </Text>
      <OccupancyBar pct={slot.occupancyPct} />
      {note ? <Text className="mt-2 text-sm text-foreground">{note}</Text> : null}
    </Pressable>
  );
}

function Badge({ label, badgeClassName }: { label: string; badgeClassName: string }) {
  return (
    <Text
      className={`overflow-hidden rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClassName}`}
    >
      {label}
    </Text>
  );
}

function OccupancyBar({ pct }: { pct: number }) {
  const color = pct >= 100 ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-primary';
  return (
    <View
      className="mt-2 h-2 overflow-hidden rounded-full bg-surface"
      importantForAccessibility="no"
    >
      <View className={`h-2 ${color}`} style={{ width: `${pct}%` }} />
    </View>
  );
}
