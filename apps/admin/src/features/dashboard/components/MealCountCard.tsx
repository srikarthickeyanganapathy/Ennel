import { type DashboardMeal } from '@ennel/shared';
import { Printer } from 'lucide-react';
import { formatBusinessDate } from '@/shared/lib/format';

const number = new Intl.NumberFormat('en-IN');

/**
 * Figma's green "final count" card: the plates the kitchen plans for. The design's "locked" label
 * and Share button have no backing feature yet, so the card states the date and offers Print.
 */
export function MealCountCard({ meal, date }: { meal: DashboardMeal; date: string }) {
  return (
    <section
      aria-label={`${meal.mealName} count`}
      className="flex flex-col gap-2.5 rounded-lg bg-primary p-5 text-primary-foreground"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide">
        {meal.mealName} booked · {formatBusinessDate(date, 'EEE d MMM')}
      </p>
      {meal.closureTitle ? (
        <p className="text-lg font-semibold">Mess closed: {meal.closureTitle}</p>
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <p className="text-[40px] font-bold leading-tight">{number.format(meal.booked)}</p>
          <p className="flex gap-4 text-[15px] font-medium">
            <span>Veg {number.format(meal.veg)}</span>
            <span>Non-veg {number.format(meal.nonVeg)}</span>
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={() => window.print()}
        className="mt-1 hidden min-h-11 items-center justify-center gap-1.5 rounded-md border border-primary-foreground px-3.5 text-sm font-semibold hover:bg-primary-foreground/10 sm:flex"
      >
        <Printer aria-hidden className="size-4" />
        Print
      </button>
    </section>
  );
}
