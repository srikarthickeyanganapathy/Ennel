import { View } from 'react-native';
import { type BusinessDate, MEAL_TYPE_ORDER, type MealType } from '@ennel/shared';
import { DateField } from '@/shared/components/DateField';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import { type CalendarBounds } from '@/shared/utils/calendar';
import { MEAL_LABELS } from '@/features/bookings/constants/booking-labels';

const MEAL_OPTIONS = MEAL_TYPE_ORDER.map((meal) => ({ value: meal, label: MEAL_LABELS[meal] }));

interface MealPointPickerProps {
  dateLabel: string;
  mealLabel: string;
  date: BusinessDate | null;
  mealType: MealType;
  bounds: CalendarBounds;
  onChange: (change: { date?: BusinessDate; mealType?: MealType }) => void;
}

/** A date and a meal on it, e.g. From Date + From Meal (Spec §11.1). */
export function MealPointPicker({
  dateLabel,
  mealLabel,
  date,
  mealType,
  bounds,
  onChange,
}: MealPointPickerProps) {
  return (
    <View>
      <DateField
        label={dateLabel}
        value={date}
        bounds={bounds}
        onChange={(next) => onChange({ date: next })}
      />
      <SegmentedControl
        label={mealLabel}
        options={MEAL_OPTIONS}
        selected={mealType}
        onSelect={(next) => onChange({ mealType: next as MealType })}
      />
    </View>
  );
}
