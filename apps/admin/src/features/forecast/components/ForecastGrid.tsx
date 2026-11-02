import { type ForecastMealDay } from '@ennel/shared';
import { TABLE_HEAD } from '@/shared/components/table-styles';
import { formatBusinessDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';

const DIETS = [
  { key: 'veg', label: 'Veg' },
  { key: 'nonVeg', label: 'Non-veg' },
] as const;

/** Figma week grid (Admin §N): a row per meal and diet, booked with expected plates beneath. */
export function ForecastGrid({
  dates,
  today,
  meals,
}: {
  dates: string[];
  today: string;
  meals: ForecastMealDay[];
}) {
  const names = [...new Map(meals.map((meal) => [meal.mealType, meal.mealName])).entries()];
  return (
    <div className="relative overflow-x-auto rounded-lg border border-border bg-background">
      <table className="w-full min-w-[820px] table-fixed border-separate border-spacing-0.5">
        <caption className="sr-only">Booked and expected plates for the week</caption>
        <thead className="bg-neutral-surface">
          <tr>
            <th scope="col" className={cn(TABLE_HEAD, 'w-40')}>
              Meal · type
            </th>
            {dates.map((date) => (
              <th
                key={date}
                scope="col"
                className={cn(TABLE_HEAD, date === today && 'text-primary')}
              >
                {formatBusinessDate(date, 'EEE d')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {names.flatMap(([mealType, mealName]) =>
            DIETS.map((diet) => (
              <tr key={`${mealType}-${diet.key}`}>
                <th scope="row" className="py-3 pl-5 text-left text-[13px] font-semibold">
                  {mealName} · {diet.label}
                </th>
                {dates.map((date) => (
                  <PlatesCell
                    key={date}
                    meal={meals.find((item) => item.date === date && item.mealType === mealType)}
                    diet={diet.key}
                  />
                ))}
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}

function PlatesCell({ meal, diet }: { meal: ForecastMealDay | undefined; diet: 'veg' | 'nonVeg' }) {
  if (!meal) return <td className="bg-surface" />;
  if (meal.closureTitle) {
    return (
      <td className="bg-warning-surface px-3 py-2 text-xs font-medium" title={meal.closureTitle}>
        Closed
      </td>
    );
  }
  const plates = meal[diet];
  return (
    <td className={cn('px-3 py-2', meal.isLocked ? 'bg-neutral-surface' : 'bg-info-surface')}>
      <span className="block text-sm font-semibold">{plates.booked}</span>
      <span className="block text-xs text-muted-foreground">exp. {plates.expected}</span>
      <span className="sr-only">{meal.isLocked ? 'Locked' : 'Open'}</span>
    </td>
  );
}
