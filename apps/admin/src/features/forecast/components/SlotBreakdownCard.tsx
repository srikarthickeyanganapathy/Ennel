import { type ForecastMealDay } from '@ennel/shared';
import { useState } from 'react';
import { TABLE_CELL, TABLE_HEAD } from '@/shared/components/table-styles';
import { Card } from '@/shared/components/ui/card';
import { Select } from '@/shared/components/ui/form-controls';
import { formatBusinessDate } from '@/shared/lib/format';

/** Admin §N "per slot": what the grid adds up, for one chosen day. */
export function SlotBreakdownCard({
  dates,
  initialDate,
  meals,
}: {
  dates: string[];
  initialDate: string;
  meals: ForecastMealDay[];
}) {
  const [picked, setPicked] = useState(initialDate);
  const date = dates.includes(picked) ? picked : (dates[0] ?? initialDate);
  const dayMeals = meals.filter((meal) => meal.date === date && !meal.closureTitle);
  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3">
        <div>
          <h2 className="text-base font-semibold">By slot</h2>
          <p className="text-xs text-muted-foreground">Booked, with expected plates in brackets</p>
        </div>
        <Select
          aria-label="Day"
          className="w-44"
          value={date}
          onChange={(event) => setPicked(event.target.value)}
        >
          {dates.map((item) => (
            <option key={item} value={item}>
              {formatBusinessDate(item, 'EEE, d MMM')}
            </option>
          ))}
        </Select>
      </div>
      {dayMeals.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">The mess is closed this day.</p>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <caption className="sr-only">Plates by slot</caption>
            <thead className="bg-neutral-surface">
              <tr>
                <th scope="col" className={TABLE_HEAD}>
                  Meal and slot
                </th>
                <th scope="col" className={TABLE_HEAD}>
                  Veg
                </th>
                <th scope="col" className={TABLE_HEAD}>
                  Non-veg
                </th>
                <th scope="col" className={TABLE_HEAD}>
                  Show-up
                </th>
              </tr>
            </thead>
            <tbody>
              {dayMeals.flatMap((meal) => [
                <tr key={meal.mealType} className="border-t border-border bg-surface font-semibold">
                  <th scope="rowgroup" className={`${TABLE_CELL} text-left font-semibold`}>
                    {meal.mealName}
                  </th>
                  <td className={TABLE_CELL}>
                    {meal.veg.booked} ({meal.veg.expected})
                  </td>
                  <td className={TABLE_CELL}>
                    {meal.nonVeg.booked} ({meal.nonVeg.expected})
                  </td>
                  <td className={TABLE_CELL}>
                    {meal.daysUsed === 0
                      ? 'No history yet'
                      : `${meal.showUpRatePct}% over ${meal.daysUsed} days`}
                  </td>
                </tr>,
                ...meal.slots.map((slot) => (
                  <tr key={slot.slotId} className="border-t border-border">
                    <th scope="row" className={`${TABLE_CELL} text-left font-normal`}>
                      {slot.label}
                    </th>
                    <td className={TABLE_CELL}>
                      {slot.veg.booked} ({slot.veg.expected})
                    </td>
                    <td className={TABLE_CELL}>
                      {slot.nonVeg.booked} ({slot.nonVeg.expected})
                    </td>
                    <td className={TABLE_CELL} />
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
