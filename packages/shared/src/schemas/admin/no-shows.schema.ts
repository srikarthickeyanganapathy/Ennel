import { z } from 'zod';
import { AppealStatus, NoShowStatus } from '../../enums/attendance.js';
import {
  businessDateSchema,
  overrideReasonSchema,
  paginatedResponseSchema,
  paginationQuerySchema,
  uuidSchema,
} from '../common.schema.js';
import { mealTypeSchema } from '../meal-config.schema.js';
import { NO_SHOW_EXCLUSION_CAUSES, noShowAppealSummarySchema } from '../no-shows.schema.js';

const studentRefSchema = z.object({
  id: uuidSchema,
  fullName: z.string(),
  referenceNumber: z.string(),
  blockName: z.string().nullable(),
});

/** One No-show event for staff (Admin §J). */
export const adminNoShowEventSchema = z.object({
  id: uuidSchema,
  date: businessDateSchema,
  mealType: mealTypeSchema,
  status: z.enum(NoShowStatus),
  exclusionCause: z.enum(NO_SHOW_EXCLUSION_CAUSES).nullable(),
  excludedReason: z.string().nullable(),
  excludedByName: z.string().nullable(),
  student: studentRefSchema,
  /** The student's counted No-shows for this meal in the rolling window. */
  currentCount: z.number().int(),
  isAutoDisabled: z.boolean(),
  appeal: noShowAppealSummarySchema.nullable(),
  createdAt: z.iso.datetime(),
});
export type AdminNoShowEvent = z.infer<typeof adminNoShowEventSchema>;

/** `GET /admin/no-shows`; `appeal=PENDING` is the appeal queue, `status=HELD_FOR_REVIEW` the outage review. */
export const adminNoShowListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(NoShowStatus).optional(),
  appeal: z.enum(AppealStatus).optional(),
  mealType: mealTypeSchema.optional(),
  from: businessDateSchema.optional(),
  to: businessDateSchema.optional(),
  hostelBlockId: uuidSchema.optional(),
});
export type AdminNoShowListQuery = z.input<typeof adminNoShowListQuerySchema>;

export const adminNoShowListResponseSchema = paginatedResponseSchema(adminNoShowEventSchema).extend(
  {
    pendingAppeals: z.number().int(),
    heldForReview: z.number().int(),
  },
);
export type AdminNoShowList = z.infer<typeof adminNoShowListResponseSchema>;

/** `GET /admin/no-shows/at-risk`: students at the warning level for a meal (BR-NS-4). */
export const noShowAtRiskSchema = z.object({
  windowDays: z.number().int(),
  warningThreshold: z.number().int(),
  disableThreshold: z.number().int(),
  /** All students at risk; `items` holds the highest counts first and may be shorter. */
  total: z.number().int(),
  items: z.array(
    z.object({ student: studentRefSchema, mealType: mealTypeSchema, count: z.number().int() }),
  ),
});
export type NoShowAtRisk = z.infer<typeof noShowAtRiskSchema>;

export const decideAppealRequestSchema = z.object({ reason: overrideReasonSchema.optional() });
export const rejectAppealRequestSchema = z.object({ reason: overrideReasonSchema });
export const reviewHeldRequestSchema = z.object({ reason: overrideReasonSchema });

/** `POST /admin/students/{id}/no-shows/reset` and `/default-booking/re-enable` (BR-NS-6/8). */
export const studentMealActionRequestSchema = z.object({
  mealType: mealTypeSchema,
  reason: overrideReasonSchema,
});
export type StudentMealActionRequest = z.input<typeof studentMealActionRequestSchema>;

export const noShowActionResultSchema = z.object({
  /** Events changed by the action. */
  changed: z.number().int(),
  count: z.number().int(),
  isAutoDisabled: z.boolean(),
});
export type NoShowActionResult = z.infer<typeof noShowActionResultSchema>;
