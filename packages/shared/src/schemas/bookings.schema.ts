import { z } from 'zod';
import { BookingSource, BookingStatus } from '../enums/booking.js';
import { businessDateSchema, uuidSchema } from './common.schema.js';
import { dietTypeSchema, mealTypeSchema } from './meal-config.schema.js';

/** Which intent produced the meal's state (BR-BOOK-4, ADR-0014). */
export const APPLIED_RULES = [
  'CLOSURE',
  'LEAVE',
  'DATE_EXCEPTION',
  'WEEKDAY_RULE',
  'DEFAULT',
  'NONE',
] as const;
export type AppliedRule = (typeof APPLIED_RULES)[number];

/** Derived status label for a meal card; never stored (BR-BOOK-3, Spec §4.3). */
export const BOOKING_LABELS = [
  'NOT_BOOKED_DEFAULT_OFF',
  'NOT_BOOKED',
  'BOOKED_DEFAULT',
  'BOOKED_WEEKDAY_RULE',
  'BOOKED_ONCE',
  'CHANGED_FOR_THIS_DAY',
  'CANCELLED',
  'PAUSED_LEAVE',
  'MESS_CLOSED',
  'NO_SHOW',
  'COMPLETED',
] as const;
export type BookingLabel = (typeof BOOKING_LABELS)[number];

export const bookingStatusSchema = z.enum(BookingStatus);
export const bookingSourceSchema = z.enum(BookingSource);

/** One action on a meal card. The server decides; the app only renders (Spec §14). */
export const mealActionSchema = z.object({
  allowed: z.boolean(),
  /** Why it is not allowed, in the student's words; null when allowed or not applicable. */
  reason: z.string().nullable(),
  /** When the action closes, for countdowns (Spec §4.5, ADR-0010). */
  deadlineAt: z.iso.datetime().nullable(),
});
export type MealAction = z.infer<typeof mealActionSchema>;

export const cardBookingSchema = z.object({
  id: uuidSchema,
  slotId: uuidSchema,
  slotLabel: z.string(),
  slotStartMinute: z.number().int(),
  slotEndMinute: z.number().int(),
  dietType: dietTypeSchema,
  status: bookingStatusSchema,
  source: bookingSourceSchema,
  isOverCapacity: z.boolean(),
  /** Admin §H: shown as "Updated by mess staff". */
  isUpdatedByStaff: z.boolean(),
  version: z.number().int(),
});
export type CardBooking = z.infer<typeof cardBookingSchema>;

export const mealCardSchema = z.object({
  mealType: mealTypeSchema,
  mealName: z.string(),
  date: businessDateSchema,
  serviceStartMinute: z.number().int(),
  serviceEndMinute: z.number().int(),
  label: z.enum(BOOKING_LABELS),
  appliedRule: z.enum(APPLIED_RULES),
  closureTitle: z.string().nullable(),
  booking: cardBookingSchema.nullable(),
  actions: z.object({
    book: mealActionSchema,
    changeSlot: mealActionSchema,
    changeDiet: mealActionSchema,
    cancel: mealActionSchema,
  }),
});
export type MealCard = z.infer<typeof mealCardSchema>;

/** `GET /api/v1/days/{date}`: the Home page's three meal cards (Spec §4). */
export const dayResponseSchema = z.object({
  date: businessDateSchema,
  today: businessDateSchema,
  lastBookableDate: businessDateSchema,
  generatedAt: z.iso.datetime(),
  meals: z.array(mealCardSchema),
});
export type DayResponse = z.infer<typeof dayResponseSchema>;

export const bookMealRequestSchema = z.object({
  date: businessDateSchema,
  mealType: mealTypeSchema,
  slotId: uuidSchema,
  dietType: dietTypeSchema,
});
export type BookMealRequest = z.input<typeof bookMealRequestSchema>;

export const changeBookingRequestSchema = z
  .object({
    slotId: uuidSchema.optional(),
    dietType: dietTypeSchema.optional(),
    version: z.number().int().min(1),
  })
  .refine((body) => body.slotId !== undefined || body.dietType !== undefined, {
    message: 'Choose a new slot or meal type',
    path: ['slotId'],
  });
export type ChangeBookingRequest = z.input<typeof changeBookingRequestSchema>;

/** `POST /api/v1/days/{date}/cancel-eligible` (Spec §4.4, BR-DEAD-6). */
export const cancelEligibleResponseSchema = z.object({
  cancelled: z.array(mealTypeSchema),
  notEligible: z.array(z.object({ mealType: mealTypeSchema, reason: z.string() })),
  day: dayResponseSchema,
});
export type CancelEligibleResponse = z.infer<typeof cancelEligibleResponseSchema>;

/** Header required on booking writes (ADR-0016). */
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
export const idempotencyKeySchema = uuidSchema;
