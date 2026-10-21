import { z } from 'zod';
import { AvailabilityLabel } from '../enums/booking.js';
import { businessDateSchema, uuidSchema } from './common.schema.js';
import { mealTypeSchema } from './meal-config.schema.js';

/** Primary label of a slot (BR-CAP-5). "Recommended" is a separate flag, never a status. */
export const SLOT_STATUS_LABELS = [
  AvailabilityLabel.AVAILABLE,
  AvailabilityLabel.FILLING_FAST,
  AvailabilityLabel.FULL,
  AvailabilityLabel.OVER_CAPACITY,
] as const;
export type SlotStatusLabel = (typeof SLOT_STATUS_LABELS)[number];

/** Why a slot cannot be chosen right now (Spec §14: disable and explain why). */
export const SLOT_UNAVAILABLE_REASONS = ['CLOSED', 'STARTED', 'FULL'] as const;
export type SlotUnavailableReason = (typeof SLOT_UNAVAILABLE_REASONS)[number];

export const slotAvailabilityQuerySchema = z.object({
  date: businessDateSchema,
  meal: mealTypeSchema,
});
export type SlotAvailabilityQuery = z.input<typeof slotAvailabilityQuerySchema>;

export const slotAvailabilitySchema = z.object({
  slotId: uuidSchema,
  label: z.string(),
  startMinute: z.number().int(),
  endMinute: z.number().int(),
  /** BR-CAP-1: per-date override, else weekday capacity, else the slot default. */
  officialCapacity: z.number().int(),
  /** Accepted bookings for this slot and date (BR-CAP-2). */
  bookedCount: z.number().int(),
  overCapacityCount: z.number().int(),
  /** 0–100, of official capacity (BR-CAP-3). */
  occupancyPct: z.number().int(),
  status: z.enum(SLOT_STATUS_LABELS),
  isRecommended: z.boolean(),
  canSelect: z.boolean(),
  unavailableReason: z.enum(SLOT_UNAVAILABLE_REASONS).nullable(),
});
export type SlotAvailability = z.infer<typeof slotAvailabilitySchema>;

/** `GET /api/v1/slots/availability?date&meal` (Spec §5). */
export const slotAvailabilityResponseSchema = z.object({
  date: businessDateSchema,
  mealType: mealTypeSchema,
  mealName: z.string(),
  serviceStartMinute: z.number().int(),
  serviceEndMinute: z.number().int(),
  isClosed: z.boolean(),
  closureTitle: z.string().nullable(),
  /** Spec §5.2 / ADR-0005: when true, a slot at capacity still accepts bookings. */
  allowOverCapacityBooking: z.boolean(),
  /** Last date the student may view or book (ADR-0011). */
  lastBookableDate: businessDateSchema,
  generatedAt: z.iso.datetime(),
  slots: z.array(slotAvailabilitySchema),
});
export type SlotAvailabilityResponse = z.infer<typeof slotAvailabilityResponseSchema>;
