import { type DashboardMeal } from '@ennel/shared';
import { type ReactNode } from 'react';
import { Card } from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/utils';

const number = new Intl.NumberFormat('en-IN');
const percent = (part: number, whole: number) =>
  whole === 0 ? 0 : Math.round((part / whole) * 100);

/**
 * Admin §C headline numbers for the selected meal, laid out like the Figma KPI row.
 * The design's sparklines and "vs yesterday" deltas have no per-meal data yet, so they are left out.
 */
export function MealKpis({ meal }: { meal: DashboardMeal }) {
  const overCapacity = meal.overCapacitySlotCount;
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 xl:gap-6">
      <Kpi
        label={`${meal.mealName} booked`}
        value={number.format(meal.booked)}
        note={
          overCapacity > 0 ? (
            <span className="font-semibold text-danger">{overCapacity} over capacity</span>
          ) : (
            `${meal.slots.length} ${meal.slots.length === 1 ? 'slot' : 'slots'}`
          )
        }
      />
      <Kpi
        label="Veg / Non-veg"
        value={`${number.format(meal.veg)} / ${number.format(meal.nonVeg)}`}
        note={`${percent(meal.veg, meal.booked)}% veg`}
      />
      <Kpi
        label="Expected plates"
        value={number.format(meal.expected)}
        note={
          <>
            Booked × {meal.showUpRatePct}% show-up rate
            {meal.isExpectedLowConfidence ? (
              <span className="font-semibold text-warning"> · low confidence</span>
            ) : null}
          </>
        }
      />
      <Kpi
        label="Served so far"
        value={number.format(meal.attended)}
        note={
          <>
            <span className="font-semibold text-success">
              {percent(meal.attended, meal.booked)}%
            </span>{' '}
            of booked
          </>
        }
      />
    </div>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note: ReactNode }) {
  return (
    <Card className="flex flex-col gap-1 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] sm:gap-2 sm:p-5">
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <p className={cn('font-bold leading-tight text-foreground', 'text-2xl sm:text-[28px]')}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </Card>
  );
}
