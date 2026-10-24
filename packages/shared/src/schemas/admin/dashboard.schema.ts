import { z } from 'zod';
import { businessDateSchema, uuidSchema } from '../common.schema.js';
import { mealTypeSchema } from '../meal-config.schema.js';
import { SLOT_STATUS_LABELS } from '../slot-availability.schema.js';

/** Admin §C. Without `dashboard:read`, only today is allowed (MESS_STAFF, WARDEN). */
export const dashboardQuerySchema = z.object({ date: businessDateSchema.optional() });
export type DashboardQuery = z.input<typeof dashboardQuerySchema>;

export const dashboardSlotSchema = z.object({
  slotId: uuidSchema,
  label: z.string(),
  officialCapacity: z.number().int(),
  bookedCount: z.number().int(),
  occupancyPct: z.number().int(),
  status: z.enum(SLOT_STATUS_LABELS),
  isRecommended: z.boolean(),
});

export const dashboardMealSchema = z.object({
  mealType: mealTypeSchema,
  mealName: z.string(),
  closureTitle: z.string().nullable(),
  booked: z.number().int(),
  /** BR-FC-1: booked × show-up rate. */
  expected: z.number().int(),
  showUpRatePct: z.number().int(),
  isExpectedLowConfidence: z.boolean(),
  attended: z.number().int(),
  veg: z.number().int(),
  nonVeg: z.number().int(),
  overCapacitySlotCount: z.number().int(),
  slots: z.array(dashboardSlotSchema),
});
export type DashboardMeal = z.infer<typeof dashboardMealSchema>;

export const pendingWorkSchema = z.object({
  leaveApprovals: z.number().int(),
  openComplaints: z.number().int(),
  noShowAppeals: z.number().int(),
  attendanceIssues: z.number().int(),
});
export type PendingWork = z.infer<typeof pendingWorkSchema>;

export const trendDaySchema = z.object({
  date: businessDateSchema,
  booked: z.number().int(),
  completed: z.number().int(),
  noShows: z.number().int(),
  /** No-shows ÷ (completed + no-shows); null before attendance exists for the day. */
  noShowRatePct: z.number().int().nullable(),
});
export type TrendDay = z.infer<typeof trendDaySchema>;

export const dashboardSchema = z.object({
  date: businessDateSchema,
  today: businessDateSchema,
  canChooseDate: z.boolean(),
  generatedAt: z.iso.datetime(),
  meals: z.array(dashboardMealSchema),
  pending: pendingWorkSchema,
  /** The 7 days ending on `date`. */
  trend: z.array(trendDaySchema),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
