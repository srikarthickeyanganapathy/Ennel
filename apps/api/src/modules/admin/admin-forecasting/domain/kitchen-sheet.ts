import { type Forecast, formatBusinessDateLabel } from '@ennel/shared';
import { type ReportCell, type ReportDocument } from '../../../../common/files/report-exporter';

const COLUMNS = [
  'Slot',
  'Veg booked',
  'Veg expected',
  'Non-veg booked',
  'Non-veg expected',
  'Total expected',
];

/** Admin §N printable kitchen sheet: one table per date, one block of slots per meal. */
export function kitchenSheet(forecast: Forecast): ReportDocument {
  const dates = [...new Set(forecast.meals.map((meal) => meal.date))];
  const last = dates[dates.length - 1] ?? forecast.from;
  return {
    fileName: `kitchen-sheet-${forecast.from}`,
    title: 'Kitchen sheet',
    subtitle: `${formatBusinessDateLabel(forecast.from)} to ${formatBusinessDateLabel(last)}. Expected = booked × show-up rate over the last ${forecast.lookbackDays} days with data.`,
    tables: dates.map((date) => {
      const meals = forecast.meals.filter((meal) => meal.date === date);
      const lowConfidence = meals.filter((meal) => meal.isLowConfidence && !meal.closureTitle);
      return {
        title: formatBusinessDateLabel(date),
        note:
          lowConfidence.length > 0
            ? `Low confidence, under 7 days of history: ${lowConfidence.map((meal) => meal.mealName).join(', ')}.`
            : undefined,
        columns: COLUMNS,
        rows: meals.flatMap((meal): ReportCell[][] => {
          if (meal.closureTitle) return [[`${meal.mealName}: closed (${meal.closureTitle})`]];
          return [
            [
              `${meal.mealName} (${meal.showUpRatePct}% show up)`,
              meal.veg.booked,
              meal.veg.expected,
              meal.nonVeg.booked,
              meal.nonVeg.expected,
              meal.veg.expected + meal.nonVeg.expected,
            ],
            ...meal.slots.map((slot): ReportCell[] => [
              `  ${slot.label}`,
              slot.veg.booked,
              slot.veg.expected,
              slot.nonVeg.booked,
              slot.nonVeg.expected,
              slot.veg.expected + slot.nonVeg.expected,
            ]),
          ];
        }),
      };
    }),
  };
}
