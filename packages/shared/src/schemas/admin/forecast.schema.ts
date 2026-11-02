import { z } from 'zod';
import { businessDateSchema, uuidSchema } from '../common.schema.js';
import { mealTypeSchema } from '../meal-config.schema.js';

export const FORECAST_MAX_DAYS = 31;
export const SHEET_FORMATS = ['pdf', 'xlsx'] as const;

export const forecastQuerySchema = z.object({
  from: businessDateSchema,
  days: z.coerce.number().int().min(1).max(FORECAST_MAX_DAYS).default(7),
});
export type ForecastQuery = z.input<typeof forecastQuerySchema>;

export const forecastExportQuerySchema = forecastQuerySchema.extend({
  format: z.enum(SHEET_FORMATS),
});
export type ForecastExportQuery = z.input<typeof forecastExportQuerySchema>;

const platesSchema = z.object({ booked: z.number().int(), expected: z.number().int() });

/** One meal on one date (Admin §N, BR-FC-1). Expected plates round up per slot and diet. */
export const forecastMealDaySchema = z.object({
  date: businessDateSchema,
  mealType: mealTypeSchema,
  mealName: z.string(),
  closureTitle: z.string().nullable(),
  /** The last slot's cancel deadline has passed, so students can no longer lower the number. */
  isLocked: z.boolean(),
  showUpRatePct: z.number().int(),
  daysUsed: z.number().int(),
  isLowConfidence: z.boolean(),
  veg: platesSchema,
  nonVeg: platesSchema,
  slots: z.array(
    z.object({
      slotId: uuidSchema,
      label: z.string(),
      veg: platesSchema,
      nonVeg: platesSchema,
    }),
  ),
});
export type ForecastMealDay = z.infer<typeof forecastMealDaySchema>;

export const forecastSchema = z.object({
  from: businessDateSchema,
  days: z.number().int(),
  today: businessDateSchema,
  lookbackDays: z.number().int(),
  generatedAt: z.iso.datetime(),
  meals: z.array(forecastMealDaySchema),
  /** Last 30 days, all meals. */
  trend: z.array(
    z.object({ date: businessDateSchema, booked: z.number().int(), served: z.number().int() }),
  ),
  /** Last 4 complete weeks, oldest first. A plate is booked but not attended (ADR-0029). */
  wasteWeeks: z.array(z.object({ weekStart: businessDateSchema, plates: z.number().int() })),
});
export type Forecast = z.infer<typeof forecastSchema>;
