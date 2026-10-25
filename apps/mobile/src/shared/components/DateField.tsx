import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { type BusinessDate } from '@ennel/shared';
import { type CalendarBounds, monthOf } from '@/shared/utils/calendar';
import { formatBusinessDate } from '@/shared/utils/format-date';
import { MonthCalendar } from './MonthCalendar';

interface DateFieldProps {
  label: string;
  value: BusinessDate | null;
  bounds: CalendarBounds;
  onChange: (date: BusinessDate) => void;
}

/** A date with a calendar that opens under it; the chosen date is always written out. */
export function DateField({ label, value, bounds, onChange }: DateFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [month, setMonth] = useState(() => monthOf(value ?? bounds.firstDate));
  return (
    <View className="mb-4">
      <Text className="mb-1 text-sm font-medium text-foreground">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatBusinessDate(value) : 'not chosen'}`}
        accessibilityState={{ expanded: isOpen }}
        onPress={() => setIsOpen((open) => !open)}
        className="min-h-12 flex-row items-center justify-between rounded-md border border-border bg-background px-3"
      >
        <Text className={value ? 'text-base text-foreground' : 'text-base text-muted-foreground'}>
          {value ? formatBusinessDate(value) : 'Choose a date'}
        </Text>
        <Text className="text-sm text-primary">{isOpen ? 'Close' : 'Change'}</Text>
      </Pressable>
      {isOpen ? (
        <View className="mt-2">
          <MonthCalendar
            month={month}
            onMonthChange={setMonth}
            bounds={bounds}
            selected={value}
            onSelect={(date) => {
              onChange(date);
              setIsOpen(false);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
