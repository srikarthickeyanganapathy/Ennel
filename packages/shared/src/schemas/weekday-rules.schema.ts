import { z } from 'zod';
import { uuidSchema, weekdaySchema } from './common.schema.js';
import { dietTypeSchema, mealTypeSchema } from './meal-config.schema.js';

export const weekdayListSchema = z
  .array(weekdaySchema)
  .min(1, 'Choose at least one day')
  .max(7)
  .refine((days) => new Set(days).size === days.length, { message: 'Each day can appear once' })
  .transform((days) => [...days].sort((a, b) => a - b));

/** A saved Plan Ahead weekday rule (Spec §6.2). */
export const weekdayRuleSchema = z.object({
  id: uuidSchema,
  mealType: mealTypeSchema,
  mealName: z.string(),
  weekdays: z.array(weekdaySchema),
  slotId: uuidSchema,
  slotLabel: z.string(),
  dietType: dietTypeSchema,
  version: z.number().int(),
  /** Why the rule is not booking right now (ADR-0024), or null when it applies. */
  pausedReason: z.enum(['DEFAULT_BOOKING_OFF', 'AUTO_DISABLED']).nullable(),
});
export type WeekdayRule = z.infer<typeof weekdayRuleSchema>;

export const weekdayRulesResponseSchema = z.object({ items: z.array(weekdayRuleSchema) });
export type WeekdayRulesResponse = z.infer<typeof weekdayRulesResponseSchema>;

const ruleMealSchema = z.object({
  mealType: mealTypeSchema,
  slotId: uuidSchema,
  dietType: dietTypeSchema,
});

/** `POST /weekday-rules`: the same days for one or more meals, one rule per meal (Spec §6.2). */
export const createWeekdayRulesRequestSchema = z.object({
  weekdays: weekdayListSchema,
  meals: z
    .array(ruleMealSchema)
    .min(1, 'Choose at least one meal')
    .max(3)
    .refine((meals) => new Set(meals.map((meal) => meal.mealType)).size === meals.length, {
      message: 'Each meal can appear once',
    }),
});
export type CreateWeekdayRulesRequest = z.input<typeof createWeekdayRulesRequestSchema>;

/** `PATCH /weekday-rules/{id}`: the version shown, so a change made elsewhere is not overwritten. */
export const updateWeekdayRuleRequestSchema = z
  .object({
    weekdays: weekdayListSchema.optional(),
    slotId: uuidSchema.optional(),
    dietType: dietTypeSchema.optional(),
    version: z.number().int().min(1),
  })
  .refine(
    (body) =>
      body.weekdays !== undefined || body.slotId !== undefined || body.dietType !== undefined,
    { message: 'Change at least one setting', path: ['weekdays'] },
  );
export type UpdateWeekdayRuleRequest = z.input<typeof updateWeekdayRuleRequestSchema>;

export const weekdayRuleResultSchema = z.object({
  items: z.array(weekdayRuleSchema),
  /** Upcoming bookings created, moved or cancelled to match (BR-PLAN-3). */
  bookingsUpdated: z.number().int(),
});
export type WeekdayRuleResult = z.infer<typeof weekdayRuleResultSchema>;

/** `DELETE /weekday-rules/{id}?version=n` (query strings are text, so the number is coerced). */
export const deleteWeekdayRuleQuerySchema = z.object({
  version: z.coerce.number().int().min(1),
});
