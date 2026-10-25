import { z } from 'zod';
import { LeaveStatus } from '../enums/leave.js';
import { businessDateSchema, uuidSchema } from './common.schema.js';
import { mealTypeSchema } from './meal-config.schema.js';

/** Business rules cap nothing; this only bounds the work one request can cause. */
export const LEAVE_MAX_DAYS = 366;

export const mealPointSchema = z.object({ date: businessDateSchema, mealType: mealTypeSchema });

/**
 * A leave's inclusive range (BR-LEAVE-1). The order check is a business rule, so it is done by the
 * API and reported as LEAVE_RANGE_INVALID rather than as a schema error.
 */
export const leaveRangeSchema = z.object({
  startDate: businessDateSchema,
  startMealType: mealTypeSchema,
  endDate: businessDateSchema,
  endMealType: mealTypeSchema,
});
export type LeaveRange = z.infer<typeof leaveRangeSchema>;

const leaveReasonSchema = z.string().trim().max(300, 'Keep the reason under 300 characters');

/** `POST /leaves` and `POST /leaves/preview` (Spec §11.1). */
export const applyLeaveRequestSchema = leaveRangeSchema.extend({
  reason: leaveReasonSchema.optional(),
});
export type ApplyLeaveRequest = z.input<typeof applyLeaveRequestSchema>;

/** Derived for display (BR-LEAVE-5); only `status` is stored. */
export const LEAVE_STATES = [
  'PENDING',
  'UPCOMING',
  'ON_LEAVE',
  'ENDED',
  'REJECTED',
  'CANCELLED',
] as const;
export type LeaveState = (typeof LEAVE_STATES)[number];

export const leaveSchema = leaveRangeSchema.extend({
  id: uuidSchema,
  reason: z.string().nullable(),
  status: z.enum(LeaveStatus),
  state: z.enum(LEAVE_STATES),
  days: z.number().int(),
  meals: z.number().int(),
  rejectionReason: z.string().nullable(),
  isCreatedByStaff: z.boolean(),
  createdAt: z.iso.datetime(),
  decidedAt: z.iso.datetime().nullable(),
  version: z.number().int(),
  /** Pending, upcoming or current leaves can be extended or ended (Spec §11.2). */
  canChange: z.boolean(),
});
export type Leave = z.infer<typeof leaveSchema>;

/** `POST /leaves/preview`: the live summary before submitting (Spec §11.1 "Leave Summary"). */
export const leavePreviewSchema = z.object({
  days: z.number().int(),
  meals: z.number().int(),
  /** What the request will be: active at once, or waiting for approval (ADR-0007). */
  status: z.enum(['APPROVED', 'PENDING']),
  /** Booked meals that will be paused (none while pending). */
  bookingsToPause: z.number().int(),
  earliestStart: mealPointSchema,
  /** Why the leave cannot be submitted, or null. */
  problem: z.string().nullable(),
});
export type LeavePreview = z.infer<typeof leavePreviewSchema>;

export const CURRENT_LEAVE_STATUSES = ['NOT_ON_LEAVE', 'UPCOMING', 'ON_LEAVE', 'PENDING'] as const;

/** `GET /leaves`: current status (Spec §11.2) and the history, newest first. */
export const leavesResponseSchema = z.object({
  current: z.object({
    status: z.enum(CURRENT_LEAVE_STATUSES),
    leave: leaveSchema.nullable(),
  }),
  items: z.array(leaveSchema),
  earliestStart: mealPointSchema,
  requiresApproval: z.boolean(),
});
export type LeavesResponse = z.infer<typeof leavesResponseSchema>;

export const extendLeaveRequestSchema = z.object({
  endDate: businessDateSchema,
  endMealType: mealTypeSchema,
  version: z.number().int().min(1),
});
export type ExtendLeaveRequest = z.input<typeof extendLeaveRequestSchema>;

/** `POST /leaves/{id}/end`: the first meal to book again (BR-LEAVE-7). */
export const endLeaveRequestSchema = z.object({
  resumeDate: businessDateSchema,
  resumeMealType: mealTypeSchema,
  version: z.number().int().min(1),
});
export type EndLeaveRequest = z.input<typeof endLeaveRequestSchema>;

export const leaveResultSchema = z.object({
  leave: leaveSchema,
  /** When approval is required, extending an approved leave asks for the extra days separately. */
  extensionRequest: leaveSchema.nullable(),
  bookingsPaused: z.number().int(),
  bookingsResumed: z.number().int(),
});
export type LeaveResult = z.infer<typeof leaveResultSchema>;
