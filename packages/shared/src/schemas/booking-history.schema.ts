import { z } from 'zod';
import { AttendanceSource } from '../enums/attendance.js';
import { bookingSourceSchema, bookingStatusSchema } from './bookings.schema.js';
import { businessDateSchema, paginatedResponseSchema, uuidSchema } from './common.schema.js';
import { dietTypeSchema, mealTypeSchema } from './meal-config.schema.js';

/** Spec §7 status filter. "Cancelled" also matches meals cancelled because the mess closed. */
export const HISTORY_STATUS_FILTERS = ['COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;
export type HistoryStatusFilter = (typeof HISTORY_STATUS_FILTERS)[number];

/** `GET /api/v1/bookings/history` (Spec §7). Dates default to the last 30 days. */
export const bookingHistoryQuerySchema = z
  .object({
    from: businessDateSchema.optional(),
    to: businessDateSchema.optional(),
    mealType: mealTypeSchema.optional(),
    status: z.enum(HISTORY_STATUS_FILTERS).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: 'The start date must be on or before the end date',
    path: ['from'],
  });
export type BookingHistoryQuery = z.input<typeof bookingHistoryQuerySchema>;

export const attendanceDetailSchema = z.object({
  source: z.enum(AttendanceSource),
  /** Set only by the face-verification system; never fabricated (BR-ATT-1). */
  verifiedAt: z.iso.datetime().nullable(),
  recordedAt: z.iso.datetime(),
});
export type AttendanceDetail = z.infer<typeof attendanceDetailSchema>;

/** `POST /api/v1/dev/attendance` (development only): simulate a face verification now. */
export const devVerificationRequestSchema = z.object({
  referenceNumber: z.string().trim().min(1).max(32),
  /** Defaults to the meal whose window is open. */
  mealType: mealTypeSchema.optional(),
});

/** One final record in My Bookings (Spec §7). */
export const bookingHistoryItemSchema = z.object({
  id: uuidSchema,
  date: businessDateSchema,
  mealType: mealTypeSchema,
  mealName: z.string(),
  slotLabel: z.string(),
  dietType: dietTypeSchema,
  status: bookingStatusSchema,
  source: bookingSourceSchema,
  cancelledAt: z.iso.datetime().nullable(),
  attendance: attendanceDetailSchema.nullable(),
  isUpdatedByStaff: z.boolean(),
});
export type BookingHistoryItem = z.infer<typeof bookingHistoryItemSchema>;

export const bookingHistoryResponseSchema = paginatedResponseSchema(
  bookingHistoryItemSchema,
).extend({
  from: businessDateSchema,
  to: businessDateSchema,
});
export type BookingHistoryResponse = z.infer<typeof bookingHistoryResponseSchema>;

/** `GET /api/v1/bookings/{id}/record`: the detailed record (Spec §7 "View Details"). */
export const bookingRecordSchema = bookingHistoryItemSchema.extend({
  slotStartMinute: z.number().int(),
  slotEndMinute: z.number().int(),
  bookedAt: z.iso.datetime(),
  /** Closure title when the meal was cancelled because the mess closed. */
  closureTitle: z.string().nullable(),
  noShow: z
    .object({
      status: z.enum(['COUNTED', 'HELD_FOR_REVIEW', 'EXCLUDED']),
      recordedAt: z.iso.datetime(),
    })
    .nullable(),
});
export type BookingRecord = z.infer<typeof bookingRecordSchema>;
