import { type DashboardMeal, type MealType } from '@ennel/shared';
import { DatePickerButton } from '@/shared/components/DatePickerButton';
import { MealSwitcher } from '@/shared/components/MealSwitcher';
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
          <DatePickerButton
            value={props.date}
            text={formatBusinessDate(props.date, 'EEE, d MMM yyyy')}
            label="Dashboard date"
            onChange={props.onDateChange}
          />
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
