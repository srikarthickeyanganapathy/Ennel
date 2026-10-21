import { z } from 'zod';
import { MINUTES_PER_DAY } from '../../constants/time.js';
import { businessDateSchema, overrideReasonSchema, uuidSchema } from '../common.schema.js';
import { mealTypeSchema } from '../meal-config.schema.js';

export const minuteOfDaySchema = z.number().int().min(0).max(MINUTES_PER_DAY);
const optionalReason = overrideReasonSchema.optional();
const capacitySchema = z.number().int().min(0).max(100_000);
export const weekdaySchema = z.number().int().min(0).max(6);

export const adminSlotSchema = z.object({
  id: uuidSchema,
  mealId: uuidSchema,
  label: z.string(),
  startMinute: z.number().int(),
  endMinute: z.number().int(),
  sortOrder: z.number().int(),
  defaultCapacity: z.number().int(),
  isActive: z.boolean(),
  version: z.number().int(),
  weekdayCapacities: z.array(z.object({ weekday: weekdaySchema, capacity: z.number().int() })),
});
export type AdminSlot = z.infer<typeof adminSlotSchema>;

export const adminMealSchema = z.object({
  id: uuidSchema,
  mealType: mealTypeSchema,
  displayName: z.string(),
  serviceStartMinute: z.number().int(),
  serviceEndMinute: z.number().int(),
  attendanceGraceMinutes: z.number().int(),
  isActive: z.boolean(),
  version: z.number().int(),
  slots: z.array(adminSlotSchema),
});
export type AdminMeal = z.infer<typeof adminMealSchema>;

export const updateMealRequestSchema = z.object({
  displayName: z.string().trim().min(2).max(40),
  serviceStartMinute: minuteOfDaySchema,
  serviceEndMinute: minuteOfDaySchema,
  attendanceGraceMinutes: z.number().int().min(0).max(240),
  version: z.number().int().min(1),
  reason: optionalReason,
});
export type UpdateMealRequest = z.input<typeof updateMealRequestSchema>;

export const createSlotRequestSchema = z.object({
  mealId: uuidSchema,
  startMinute: minuteOfDaySchema,
  endMinute: minuteOfDaySchema,
  defaultCapacity: capacitySchema,
  label: z.string().trim().min(1).max(60).optional(),
});
export type CreateSlotRequest = z.input<typeof createSlotRequestSchema>;

export const updateSlotRequestSchema = z.object({
  startMinute: minuteOfDaySchema,
  endMinute: minuteOfDaySchema,
  defaultCapacity: capacitySchema,
  label: z.string().trim().min(1).max(60).optional(),
  version: z.number().int().min(1),
  reason: optionalReason,
});
export type UpdateSlotRequest = z.input<typeof updateSlotRequestSchema>;

/** Disabling a slot that is still in use requires a slot to move its bookings to (Admin §D). */
export const disableSlotRequestSchema = z.object({
  reason: overrideReasonSchema,
  reassignToSlotId: uuidSchema.optional(),
});
export type DisableSlotRequest = z.input<typeof disableSlotRequestSchema>;

export const slotUsageSchema = z.object({
  futureBookings: z.number().int(),
  preferences: z.number().int(),
  weekdayRules: z.number().int(),
  dateExceptions: z.number().int(),
});
export type SlotUsage = z.infer<typeof slotUsageSchema>;

/** `capacity: null` removes that weekday's default so the slot default applies (BR-CAP-1). */
export const weekdayCapacitiesRequestSchema = z.object({
  capacities: z
    .array(z.object({ weekday: weekdaySchema, capacity: capacitySchema.nullable() }))
    .max(7),
  reason: optionalReason,
});
export type WeekdayCapacitiesRequest = z.input<typeof weekdayCapacitiesRequestSchema>;

export const capacityOverrideRequestSchema = z.object({
  capacity: capacitySchema,
  reason: overrideReasonSchema,
});
export type CapacityOverrideRequest = z.input<typeof capacityOverrideRequestSchema>;

export const capacityOverrideSchema = z.object({
  id: uuidSchema,
  slotId: uuidSchema,
  mealDate: z.string(),
  capacity: z.number().int(),
  reason: z.string(),
});
export type CapacityOverride = z.infer<typeof capacityOverrideSchema>;

export const CAPACITY_SCOPES = ['DEFAULT', 'WEEKDAY', 'DATE'] as const;

/** "Lowering capacity below current bookings shows a warning with impact counts" (Admin §D). */
export const capacityImpactQuerySchema = z
  .object({
    capacity: z.coerce.number().int().min(0),
    scope: z.enum(CAPACITY_SCOPES),
    weekday: z.coerce.number().int().min(0).max(6).optional(),
    date: businessDateSchema.optional(),
  })
  // A WEEKDAY or DATE check without its weekday or date would silently report another scope.
  .refine((query) => query.scope !== 'WEEKDAY' || query.weekday !== undefined, {
    path: ['weekday'],
    message: 'Choose a weekday',
  })
  .refine((query) => query.scope !== 'DATE' || query.date !== undefined, {
    path: ['date'],
    message: 'Choose a date',
  });
export type CapacityImpactQuery = z.input<typeof capacityImpactQuerySchema>;

export const capacityImpactSchema = z.object({
  affectedDates: z.array(
    z.object({ mealDate: z.string(), bookedCount: z.number().int(), overBy: z.number().int() }),
  ),
  totalOverBy: z.number().int(),
});
export type CapacityImpact = z.infer<typeof capacityImpactSchema>;

/** Availability label thresholds (ADR-0013); readable with mess-config:read. */
export const thresholdsSchema = z.object({
  fillingFastThresholdPct: z.number().int(),
  recommendedMaxOccupancyPct: z.number().int(),
  /** The mess_policy version, sent back on save. */
  version: z.number().int(),
});
export type Thresholds = z.infer<typeof thresholdsSchema>;

export const thresholdsRequestSchema = z.object({
  fillingFastThresholdPct: z.number().int().min(1).max(99),
  recommendedMaxOccupancyPct: z.number().int().min(1).max(99),
  version: z.number().int().min(1),
  reason: overrideReasonSchema,
});
export type ThresholdsRequest = z.input<typeof thresholdsRequestSchema>;

export const adminHostelSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  isActive: z.boolean(),
  blocks: z.array(
    z.object({
      id: uuidSchema,
      name: z.string(),
      isActive: z.boolean(),
      studentCount: z.number().int(),
    }),
  ),
});
export type AdminHostel = z.infer<typeof adminHostelSchema>;

export const hostelNameRequestSchema = z.object({ name: z.string().trim().min(1).max(120) });
export const hostelUpdateRequestSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
});
