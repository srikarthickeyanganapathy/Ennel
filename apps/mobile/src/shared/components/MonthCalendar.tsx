import { Pressable, Text, View } from 'react-native';
import { type BusinessDate } from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import {
  buildMonth,
  CALENDAR_WEEKDAYS,
  type CalendarBounds,
  type CalendarCell,
  monthOf,
  monthTitle,
  shiftMonth,
} from '@/shared/utils/calendar';
import { formatBusinessDate } from '@/shared/utils/format-date';

interface MonthCalendarProps {
  month: string;
  onMonthChange: (month: string) => void;
  bounds: CalendarBounds;
  selected: BusinessDate | null;
  onSelect: (date: BusinessDate) => void;
}

/** A month grid with previous/next month limited to the bounds (Spec §6.1, §7). */
export function MonthCalendar({
  month,
  onMonthChange,
  bounds,
  selected,
  onSelect,
}: MonthCalendarProps) {
  const weeks = buildMonth(month, bounds);
  return (
    <View>
      <View className="mb-3 flex-row items-center justify-between">
        <AppButton
          label="‹ Previous"
          variant="secondary"
          isDisabled={month <= monthOf(bounds.firstDate)}
          onPress={() => onMonthChange(shiftMonth(month, -1))}
        />
        <Text className="text-base font-semibold text-foreground" accessibilityRole="header">
          {monthTitle(month)}
        </Text>
        <AppButton
          label="Next ›"
          variant="secondary"
          isDisabled={month >= monthOf(bounds.lastDate)}
          onPress={() => onMonthChange(shiftMonth(month, 1))}
        />
      </View>
      <View className="flex-row">
        {CALENDAR_WEEKDAYS.map((name) => (
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
                onSelect={() => onSelect(cell.date)}
              />
            ) : (
              <View key={`empty-${column}`} className="h-12 flex-1" />
            ),
          )}
        </View>
      ))}
    </View>
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
