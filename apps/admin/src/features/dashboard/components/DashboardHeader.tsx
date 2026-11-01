import { type DashboardMeal, type MealType } from '@ennel/shared';
import { Calendar, ChevronDown } from 'lucide-react';
import { useRef } from 'react';
import { cn } from '@/shared/lib/utils';
import { formatBusinessDate, formatTime } from '@/shared/lib/format';

interface DashboardHeaderProps {
  date: string | null;
  today: string | null;
  generatedAt: string | null;
  canChooseDate: boolean;
  onDateChange: (date: string | undefined) => void;
  meals: DashboardMeal[];
  selectedMeal: MealType | null;
  onMealChange: (meal: MealType) => void;
}

/** Figma "Live dashboard" top bar: title with live status, date picker, meal switcher. */
export function DashboardHeader(props: DashboardHeaderProps) {
  const isToday = props.date !== null && props.date === props.today;
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold leading-tight text-foreground">
          <span className="lg:hidden">Live</span>
          <span className="hidden lg:inline">Live dashboard</span>
        </h1>
        {props.generatedAt ? (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              aria-hidden
              className={cn('size-2 rounded-full', isToday ? 'bg-success' : 'bg-muted-foreground')}
            />
            {isToday ? 'Live' : props.date && formatBusinessDate(props.date)} · updated{' '}
            {formatTime(props.generatedAt)}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:ml-auto">
        {props.canChooseDate && props.date ? (
          <DatePicker value={props.date} onChange={props.onDateChange} />
        ) : null}
        <MealSwitcher
          meals={props.meals}
          selected={props.selectedMeal}
          onChange={props.onMealChange}
        />
      </div>
    </div>
  );
}

/** Looks like the design's date button; a real date input underneath keeps it keyboard-accessible. */
function DatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (date: string | undefined) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <label className="relative flex h-11 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
      <Calendar aria-hidden className="size-4 text-muted-foreground" />
      <span>{formatBusinessDate(value, 'EEE, d MMM yyyy')}</span>
      <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
      <input
        ref={input}
        type="date"
        aria-label="Dashboard date"
        className="absolute inset-0 cursor-pointer opacity-0"
        value={value}
        onClick={() => input.current?.showPicker?.()}
        onChange={(event) => onChange(event.target.value || undefined)}
      />
    </label>
  );
}

function MealSwitcher({
  meals,
  selected,
  onChange,
}: {
  meals: DashboardMeal[];
  selected: MealType | null;
  onChange: (meal: MealType) => void;
}) {
  if (meals.length === 0) return null;
  return (
    <div role="radiogroup" aria-label="Meal" className="flex rounded-md bg-neutral-surface p-1">
      {meals.map((meal) => {
        const isSelected = meal.mealType === selected;
        return (
          <button
            key={meal.mealType}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(meal.mealType)}
            className={cn(
              'min-h-9 flex-1 rounded-sm px-4 text-sm transition-colors sm:flex-none',
              isSelected
                ? 'bg-background font-semibold text-primary shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                : 'font-medium text-muted-foreground hover:text-foreground',
            )}
          >
            {meal.mealName}
          </button>
        );
      })}
    </div>
  );
}
