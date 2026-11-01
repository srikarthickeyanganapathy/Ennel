import { z } from 'zod';
import { AppealStatus, NoShowStatus } from '../enums/attendance.js';
import { businessDateSchema, uuidSchema } from './common.schema.js';
import { mealTypeSchema } from './meal-config.schema.js';

/** Spec §10 per-meal level: 1–2 counted, 3–4 warning, 5 disabled. */
export const NO_SHOW_LEVELS = ['NONE', 'WARNING', 'DISABLED'] as const;
export type NoShowLevel = (typeof NO_SHOW_LEVELS)[number];

export const NO_SHOW_EXCLUSION_CAUSES = [
  'APPEAL_APPROVED',
  'STAFF_RESET',
  'OUTAGE_REVIEW_DISMISSED',
] as const;

export const noShowAppealSummarySchema = z.object({
  id: uuidSchema,
  status: z.enum(AppealStatus),
  message: z.string(),
  decisionReason: z.string().nullable(),
  createdAt: z.iso.datetime(),
  decidedAt: z.iso.datetime().nullable(),
});
export type NoShowAppealSummary = z.infer<typeof noShowAppealSummarySchema>;

/** One No-show as the student sees it (Spec §7, §10). */
export const studentNoShowEventSchema = z.object({
  id: uuidSchema,
  bookingId: uuidSchema,
  date: businessDateSchema,
  mealType: mealTypeSchema,
  status: z.enum(NoShowStatus),
  exclusionCause: z.enum(NO_SHOW_EXCLUSION_CAUSES).nullable(),
  appeal: noShowAppealSummarySchema.nullable(),
  /** One report per event, while it still counts or waits for review (ADR-0027). */
  canAppeal: z.boolean(),
});
export type StudentNoShowEvent = z.infer<typeof studentNoShowEventSchema>;

export const mealNoShowSummarySchema = z.object({
  mealType: mealTypeSchema,
  mealName: z.string(),
  /** Counted No-shows in the rolling window (BR-NS-3). */
  count: z.number().int(),
  level: z.enum(NO_SHOW_LEVELS),
  /** How many more turn Default Booking off for this meal (0 once off). */
  remainingBeforeDisable: z.number().int(),
  isAutoDisabled: z.boolean(),
  /** BR-NS-6: the student may switch it back on once the count is below the threshold. */
  canReEnable: z.boolean(),
});
export type MealNoShowSummary = z.infer<typeof mealNoShowSummarySchema>;

/** `GET /api/v1/no-shows/summary`. */
export const noShowSummarySchema = z.object({
  windowDays: z.number().int(),
  warningThreshold: z.number().int(),
  disableThreshold: z.number().int(),
  meals: z.array(mealNoShowSummarySchema),
  /** Events in the window, newest first. */
  events: z.array(studentNoShowEventSchema),
});
export type NoShowSummary = z.infer<typeof noShowSummarySchema>;

/** `POST /api/v1/no-shows/{eventId}/appeals` ("Report incorrect record", Spec §7). */
export const createAppealRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(5, 'Tell the mess office what happened')
    .max(500, 'Keep it under 500 characters'),
});
export type CreateAppealRequest = z.input<typeof createAppealRequestSchema>;
