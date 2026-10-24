import { z } from 'zod';
import { SlotFullFallback } from '../enums/policy.js';
import { businessDateSchema, uuidSchema } from './common.schema.js';
import { dietTypeSchema, mealTypeSchema } from './meal-config.schema.js';
import { mealPreferenceInputSchema, mealPreferencesInputSchema } from './onboarding.schema.js';
import { SLOT_STATUS_LABELS } from './slot-availability.schema.js';

export const defaultSlotOptionSchema = z.object({
  slotId: uuidSchema,
  label: z.string(),
  startMinute: z.number().int(),
  endMinute: z.number().int(),
});
export type DefaultSlotOption = z.infer<typeof defaultSlotOptionSchema>;

/** One "Current Default Slots" card (Spec §8.2). */
export const defaultMealSettingsSchema = z.object({
  mealType: mealTypeSchema,
  mealName: z.string(),
  serviceStartMinute: z.number().int(),
  serviceEndMinute: z.number().int(),
  isEnabled: z.boolean(),
  slotId: uuidSchema.nullable(),
  slotLabel: z.string().nullable(),
  dietType: dietTypeSchema,
  /** Switched off by the no-show engine (BR-NS-5); the student's choices are kept. */
  isAutoDisabled: z.boolean(),
  slots: z.array(defaultSlotOptionSchema),
  /** How busy the preferred slot is on the next date that will be booked (Spec §8.2). */
  nextDate: businessDateSchema,
  nextDateStatus: z.enum(SLOT_STATUS_LABELS).nullable(),
});
export type DefaultMealSettings = z.infer<typeof defaultMealSettingsSchema>;

/** `GET /api/v1/default-preferences` (Spec §8). */
export const defaultPreferencesSchema = z.object({
  defaultBookingEnabled: z.boolean(),
  /** Shown read-only so students know what happens when their slot is full (ADR-0006). */
  fallbackPolicy: z.enum(SlotFullFallback),
  meals: z.array(defaultMealSettingsSchema),
});
export type DefaultPreferences = z.infer<typeof defaultPreferencesSchema>;

/** `PUT /api/v1/default-preferences`: the overall switch and all three meals together (Spec §8.3). */
export const saveDefaultPreferencesRequestSchema = z.object({
  defaultBookingEnabled: z.boolean(),
  meals: mealPreferencesInputSchema,
});
export type SaveDefaultPreferencesRequest = z.input<typeof saveDefaultPreferencesRequestSchema>;

/** `PATCH /api/v1/default-preferences/{meal}`: one meal only (Spec §8.2 "Save Changes"). */
export const updateMealPreferenceRequestSchema = mealPreferenceInputSchema
  .omit({ mealType: true })
  .partial()
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Change at least one setting',
  });
export type UpdateMealPreferenceRequest = z.input<typeof updateMealPreferenceRequestSchema>;

export const PREFERENCE_CHANGE_FIELDS = [
  'DEFAULT_BOOKING',
  'ENABLED',
  'SLOT',
  'MEAL_TYPE',
] as const;

/** One line of the "what changed" summary (Spec §8.3). */
export const preferenceChangeSchema = z.object({
  /** Null for the overall Default Booking switch. */
  mealType: mealTypeSchema.nullable(),
  field: z.enum(PREFERENCE_CHANGE_FIELDS),
  from: z.string().nullable(),
  to: z.string().nullable(),
});
export type PreferenceChange = z.infer<typeof preferenceChangeSchema>;

export const saveDefaultPreferencesResponseSchema = z.object({
  preferences: defaultPreferencesSchema,
  changes: z.array(preferenceChangeSchema),
  /** Upcoming bookings created, moved or cancelled to match (BR-DEF-3). */
  bookingsUpdated: z.number().int(),
});
export type SaveDefaultPreferencesResponse = z.infer<typeof saveDefaultPreferencesResponseSchema>;
