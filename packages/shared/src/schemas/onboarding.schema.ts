import { z } from 'zod';
import { uuidSchema } from './common.schema.js';
import { dietTypeSchema, mealTypeSchema } from './meal-config.schema.js';
import { profileFieldSchemas } from './profile.schema.js';

/** One meal's Default Booking preference (Spec §3 Screen 7, §8.2). */
export const mealPreferenceInputSchema = z.object({
  mealType: mealTypeSchema,
  isEnabled: z.boolean(),
  /** Optional for Breakfast, which has a single serving window (BR-MEAL-1). */
  slotId: uuidSchema.nullable(),
  dietType: dietTypeSchema,
});
export type MealPreferenceInput = z.infer<typeof mealPreferenceInputSchema>;

export const mealPreferencesInputSchema = z
  .array(mealPreferenceInputSchema)
  .length(3, 'Set preferences for Breakfast, Lunch and Dinner')
  .refine((items) => new Set(items.map((item) => item.mealType)).size === items.length, {
    message: 'Each meal can appear only once',
  });

/**
 * Screens 5-7 are saved together by Screen 8 "Save & Continue". Required fields are an
 * approved Phase 1 assumption: hostel block, room, student phone and parent phone; email optional.
 * College-controlled fields may be sent but are ignored unless the policy allows editing them.
 */
export const completeOnboardingRequestSchema = z.object({
  profile: z.object({
    fullName: profileFieldSchemas.fullName.optional(),
    department: profileFieldSchemas.department.optional(),
    academicYear: profileFieldSchemas.academicYear.optional(),
    hostelBlockId: profileFieldSchemas.hostelBlockId,
    roomNumber: profileFieldSchemas.roomNumber,
    phone: profileFieldSchemas.phone,
    parentPhone: profileFieldSchemas.parentPhone,
    email: profileFieldSchemas.email.nullable().optional(),
  }),
  defaultBookingEnabled: z.boolean(),
  mealPreferences: mealPreferencesInputSchema,
});
export type CompleteOnboardingRequest = z.input<typeof completeOnboardingRequestSchema>;

export const mealPreferenceSchema = mealPreferenceInputSchema.extend({
  isAutoDisabled: z.boolean(),
});
export type MealPreference = z.infer<typeof mealPreferenceSchema>;

export const mealPreferencesResponseSchema = z.object({
  defaultBookingEnabled: z.boolean(),
  items: z.array(mealPreferenceSchema),
});
export type MealPreferencesResponse = z.infer<typeof mealPreferencesResponseSchema>;
