import { MEAL_TYPE_ORDER, type MealType } from '@ennel/shared';
import { useId } from 'react';
import { Input, Label, Select } from '@/shared/components/ui/form-controls';
import { MEAL_NAMES } from './leave-labels';

interface MealPointFieldsProps {
  label: string;
  date: string;
  mealType: MealType;
  onChange: (change: { date?: string; mealType?: MealType }) => void;
}

/** A date and a meal on it, e.g. "Starts: 22 May, Breakfast" (BR-LEAVE-1). */
export function MealPointFields({ label, date, mealType, onChange }: MealPointFieldsProps) {
  const id = useId();
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        <Label htmlFor={`${id}-date`} className="sr-only">
          {label} date
        </Label>
        <Input
          id={`${id}-date`}
          type="date"
          className="w-44"
          value={date}
          onChange={(event) => onChange({ date: event.target.value })}
        />
        <Label htmlFor={`${id}-meal`} className="sr-only">
          {label} meal
        </Label>
        <Select
          id={`${id}-meal`}
          className="w-36"
          value={mealType}
          onChange={(event) => onChange({ mealType: event.target.value as MealType })}
        >
          {MEAL_TYPE_ORDER.map((meal) => (
            <option key={meal} value={meal}>
              {MEAL_NAMES[meal]}
            </option>
          ))}
        </Select>
      </div>
    </fieldset>
  );
}
