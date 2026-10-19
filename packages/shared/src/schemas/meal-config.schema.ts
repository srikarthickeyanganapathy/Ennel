import { z } from 'zod';
import { DietType, MealType } from '../enums/meal.js';
import { uuidSchema } from './common.schema.js';

export const mealTypeSchema = z.enum([MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER]);
export const dietTypeSchema = z.enum([DietType.VEG, DietType.NON_VEG]);

/** Read side of mess configuration; slots always come from the database (Rule 1). */
export const mealSlotSchema = z.object({
  id: uuidSchema,
  label: z.string(),
  startMinute: z.number().int(),
  endMinute: z.number().int(),
  sortOrder: z.number().int(),
});
export type MealSlot = z.infer<typeof mealSlotSchema>;

export const mealConfigSchema = z.object({
  id: uuidSchema,
  mealType: mealTypeSchema,
  displayName: z.string(),
  serviceStartMinute: z.number().int(),
  serviceEndMinute: z.number().int(),
  slots: z.array(mealSlotSchema),
});
export type MealConfig = z.infer<typeof mealConfigSchema>;

export const mealConfigListResponseSchema = z.object({ items: z.array(mealConfigSchema) });
