import { z } from 'zod';
import { BookingStatus } from '../../enums/booking.js';
import { bookingSourceSchema, bookingStatusSchema } from '../bookings.schema.js';
import {
  businessDateSchema,
  overrideReasonSchema,
  paginatedResponseSchema,
  paginationQuerySchema,
  uuidSchema,
} from '../common.schema.js';
import { dietTypeSchema, mealTypeSchema } from '../meal-config.schema.js';

/** Admin §H booking grid filters. */
export const adminBookingListQuerySchema = paginationQuerySchema.extend({
  date: businessDateSchema,
  mealType: mealTypeSchema.optional(),
  slotId: uuidSchema.optional(),
  status: bookingStatusSchema.optional(),
  source: bookingSourceSchema.optional(),
  hostelId: uuidSchema.optional(),
  q: z.string().trim().max(100).optional(),
});
export type AdminBookingListQuery = z.input<typeof adminBookingListQuerySchema>;

export const adminBookingSchema = z.object({
  id: uuidSchema,
  studentId: uuidSchema,
  studentName: z.string(),
  referenceNumber: z.string(),
  hostelName: z.string().nullable(),
  blockName: z.string().nullable(),
  date: businessDateSchema,
  mealType: mealTypeSchema,
  slotId: uuidSchema,
  slotLabel: z.string(),
  dietType: dietTypeSchema,
  status: bookingStatusSchema,
  source: bookingSourceSchema,
  isOverCapacity: z.boolean(),
  /** Admin §H "Updated by mess staff". */
  isUpdatedByStaff: z.boolean(),
  lastOverrideReason: z.string().nullable(),
  updatedAt: z.iso.datetime(),
  version: z.number().int(),
});
export type AdminBooking = z.infer<typeof adminBookingSchema>;
export const adminBookingPageSchema = paginatedResponseSchema(adminBookingSchema);

/** Book on behalf of a student. Overrides skip student deadlines but need a reason (BR-DEAD-7). */
export const adminCreateBookingRequestSchema = z.object({
  studentId: uuidSchema,
  date: businessDateSchema,
  mealType: mealTypeSchema,
  slotId: uuidSchema,
  dietType: dietTypeSchema,
  reason: overrideReasonSchema,
});
export type AdminCreateBookingRequest = z.input<typeof adminCreateBookingRequestSchema>;

export const adminCancelBookingRequestSchema = z.object({
  reason: overrideReasonSchema,
  version: z.number().int().min(1),
});
export type AdminCancelBookingRequest = z.input<typeof adminCancelBookingRequestSchema>;

export const adminMoveBookingRequestSchema = z.object({
  slotId: uuidSchema,
  dietType: dietTypeSchema.optional(),
  reason: overrideReasonSchema,
  version: z.number().int().min(1),
});
export type AdminMoveBookingRequest = z.input<typeof adminMoveBookingRequestSchema>;

/**
 * Status corrections staff may make now. No-show corrections come with the no-show engine
 * (Phase 9), because they change the student's rolling count (ADR-0022).
 */
export const CORRECTABLE_STATUSES = [
  BookingStatus.BOOKED,
  BookingStatus.CANCELLED,
  BookingStatus.COMPLETED,
] as const;

export const adminCorrectStatusRequestSchema = z.object({
  status: z.enum(CORRECTABLE_STATUSES),
  reason: overrideReasonSchema,
  version: z.number().int().min(1),
});
export type AdminCorrectStatusRequest = z.input<typeof adminCorrectStatusRequestSchema>;

export const BULK_BOOKING_ACTIONS = ['CANCEL', 'MOVE'] as const;
export type BulkBookingAction = (typeof BULK_BOOKING_ACTIONS)[number];

const bulkBase = z.object({
  bookingIds: z.array(uuidSchema).min(1).max(500),
  action: z.enum(BULK_BOOKING_ACTIONS),
  /** Target slot for MOVE. */
  slotId: uuidSchema.optional(),
});
const requireMoveSlot = <T extends z.infer<typeof bulkBase>>(body: T) =>
  body.action !== 'MOVE' || body.slotId !== undefined;

export const bulkBookingPreviewRequestSchema = bulkBase.refine(requireMoveSlot, {
  message: 'Choose the slot to move bookings to',
  path: ['slotId'],
});
export type BulkBookingPreviewRequest = z.input<typeof bulkBookingPreviewRequestSchema>;

export const bulkBookingApplyRequestSchema = bulkBase
  .extend({ reason: overrideReasonSchema })
  .refine(requireMoveSlot, { message: 'Choose the slot to move bookings to', path: ['slotId'] });
export type BulkBookingApplyRequest = z.input<typeof bulkBookingApplyRequestSchema>;

export const bulkBookingResultSchema = z.object({
  /** Preview: would change. Apply: changed. */
  affected: z.array(adminBookingSchema),
  skipped: z.array(z.object({ id: uuidSchema, reason: z.string() })),
});
export type BulkBookingResult = z.infer<typeof bulkBookingResultSchema>;
