import { z } from 'zod';
import { LeaveStatus } from '../../enums/leave.js';
import {
  businessDateSchema,
  overrideReasonSchema,
  paginatedResponseSchema,
  paginationQuerySchema,
  uuidSchema,
} from '../common.schema.js';
import { LEAVE_STATES, leaveRangeSchema, leaveSchema } from '../leave.schema.js';
import { mealTypeSchema } from '../meal-config.schema.js';

export const adminLeaveSchema = leaveSchema.extend({
  student: z.object({
    id: uuidSchema,
    fullName: z.string(),
    referenceNumber: z.string(),
    blockName: z.string().nullable(),
  }),
  decidedByName: z.string().nullable(),
});
export type AdminLeave = z.infer<typeof adminLeaveSchema>;

/** `GET /admin/leaves` (Admin §K list with filters). `q` matches name or reference number. */
export const adminLeaveListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(LeaveStatus).optional(),
  state: z.enum(LEAVE_STATES).optional(),
  from: businessDateSchema.optional(),
  to: businessDateSchema.optional(),
  hostelBlockId: uuidSchema.optional(),
});
export type AdminLeaveListQuery = z.input<typeof adminLeaveListQuerySchema>;
export const adminLeaveListResponseSchema = paginatedResponseSchema(adminLeaveSchema).extend({
  pendingCount: z.number().int(),
  requiresApproval: z.boolean(),
});
export type AdminLeaveList = z.infer<typeof adminLeaveListResponseSchema>;

const versionSchema = z.number().int().min(1);

export const approveLeaveRequestSchema = z.object({ version: versionSchema });
export const rejectLeaveRequestSchema = z.object({
  version: versionSchema,
  reason: overrideReasonSchema,
});

/** Staff create a leave for a student (Admin §K); approved at once, reason audited (ADR-0026). */
export const createStaffLeaveRequestSchema = leaveRangeSchema.extend({
  studentId: uuidSchema,
  reason: overrideReasonSchema,
});
export type CreateStaffLeaveRequest = z.input<typeof createStaffLeaveRequestSchema>;

export const staffEndLeaveRequestSchema = z.object({
  resumeDate: businessDateSchema,
  resumeMealType: mealTypeSchema,
  version: versionSchema,
  reason: overrideReasonSchema,
});
export type StaffEndLeaveRequest = z.input<typeof staffEndLeaveRequestSchema>;

/** `PATCH /admin/leaves/{id}`: correct the range of a leave. */
export const correctLeaveRequestSchema = leaveRangeSchema.extend({
  version: versionSchema,
  reason: overrideReasonSchema,
});
export type CorrectLeaveRequest = z.input<typeof correctLeaveRequestSchema>;

export const adminLeaveResultSchema = z.object({
  leave: adminLeaveSchema,
  bookingsPaused: z.number().int(),
  bookingsResumed: z.number().int(),
});
export type AdminLeaveResult = z.infer<typeof adminLeaveResultSchema>;

/** `GET /admin/leaves/calendar?month=YYYY-MM`: students away per day, for planning. */
export const leaveCalendarQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM'),
});
export const leaveCalendarSchema = z.object({
  month: z.string(),
  /** Students with approved leave covering at least one meal that day. */
  days: z.array(z.object({ date: businessDateSchema, count: z.number().int() })),
});
export type LeaveCalendar = z.infer<typeof leaveCalendarSchema>;
