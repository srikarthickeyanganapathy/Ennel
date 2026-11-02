import { z } from 'zod';
import { ComplaintCategory, ComplaintStatus } from '../../enums/complaint.js';
import { businessDateSchema, overrideReasonSchema, uuidSchema } from '../common.schema.js';
import { mealTypeSchema } from '../meal-config.schema.js';

/** Longest range the live report accepts. */
export const REPORT_MAX_DAYS = 366;
/** Longer exports run as a background job (Admin §O "large ranges"). */
export const REPORT_DIRECT_EXPORT_MAX_DAYS = 31;

export const REPORT_GROUPINGS = ['day', 'week', 'month'] as const;
export type ReportGrouping = (typeof REPORT_GROUPINGS)[number];
export const REPORT_FORMATS = ['csv', 'xlsx', 'pdf'] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

export const reportQuerySchema = z
  .object({
    from: businessDateSchema,
    to: businessDateSchema,
    mealType: mealTypeSchema.optional(),
    hostelId: uuidSchema.optional(),
    groupBy: z.enum(REPORT_GROUPINGS).default('day'),
  })
  .refine((query) => query.from <= query.to, {
    path: ['to'],
    message: 'The end date must not be before the start date',
  });
export type ReportQuery = z.input<typeof reportQuerySchema>;
export type ReportFilters = z.output<typeof reportQuerySchema>;

export const reportExportQuerySchema = reportQuerySchema.safeExtend({
  format: z.enum(REPORT_FORMATS),
});
export type ReportExportQuery = z.input<typeof reportExportQuerySchema>;

const countSchema = z.number().int();
const percentSchema = z.number().int().nullable();

export const CANCELLATION_BUCKETS = [
  'UNDER_1_HOUR',
  'HOURS_1_TO_6',
  'HOURS_6_TO_24',
  'OVER_24_HOURS',
] as const;
export type CancellationBucket = (typeof CANCELLATION_BUCKETS)[number];

/** `GET /admin/reports/summary` (Admin §O). Counts follow ADR-0029. */
export const adminReportSchema = z.object({
  from: businessDateSchema,
  to: businessDateSchema,
  groupBy: z.enum(REPORT_GROUPINGS),
  generatedAt: z.iso.datetime(),
  /** Choices for the hostel filter; roles with reports:read may not be able to open Hostels. */
  hostels: z.array(z.object({ id: uuidSchema, name: z.string() })),
  kpis: z.object({
    total: countSchema,
    served: countSchema,
    cancelled: countSchema,
    noShows: countSchema,
    pending: countSchema,
    noShowRatePct: percentSchema,
    previousNoShowRatePct: percentSchema,
    wastePlates: countSchema,
    previousWastePlates: countSchema,
  }),
  byMeal: z.array(
    z.object({
      mealType: mealTypeSchema,
      mealName: z.string(),
      served: countSchema,
      cancelled: countSchema,
      noShows: countSchema,
      pending: countSchema,
      total: countSchema,
      noShowRatePct: percentSchema,
    }),
  ),
  series: z.array(
    z.object({
      /** The day, or the first day of the week or month. */
      period: businessDateSchema,
      booked: countSchema,
      served: countSchema,
      noShows: countSchema,
      wastePlates: countSchema,
    }),
  ),
  byHostel: z.array(
    z.object({
      hostelId: uuidSchema.nullable(),
      hostelName: z.string(),
      served: countSchema,
      noShows: countSchema,
      noShowRatePct: percentSchema,
    }),
  ),
  slots: z.array(
    z.object({
      slotId: uuidSchema,
      mealType: mealTypeSchema,
      label: z.string(),
      startMinute: countSchema,
      averageServedPerDay: countSchema,
      /** Seats taken ÷ capacity over open days. Null when filtered to one hostel. */
      utilizationPct: percentSchema,
      overCapacityDays: countSchema,
    }),
  ),
  cancellations: z.object({
    total: countSchema,
    averageLeadMinutes: countSchema.nullable(),
    buckets: z.array(z.object({ bucket: z.enum(CANCELLATION_BUCKETS), count: countSchema })),
  }),
  leaves: z.array(z.object({ status: z.string(), count: countSchema })),
  complaints: z.object({
    total: countSchema,
    byCategory: z.array(z.object({ category: z.enum(ComplaintCategory), count: countSchema })),
    byStatus: z.array(z.object({ status: z.enum(ComplaintStatus), count: countSchema })),
    averageResolutionHours: countSchema.nullable(),
  }),
});
export type AdminReport = z.infer<typeof adminReportSchema>;

export const REPORT_EXPORT_STATUSES = ['QUEUED', 'RUNNING', 'READY', 'FAILED'] as const;

export const createReportExportRequestSchema = reportExportQuerySchema;

/** A background export of a long range. */
export const reportExportJobSchema = z.object({
  id: uuidSchema,
  status: z.enum(REPORT_EXPORT_STATUSES),
  format: z.enum(REPORT_FORMATS),
  from: businessDateSchema,
  to: businessDateSchema,
  fileName: z.string(),
  error: z.string().nullable(),
  createdAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
});
export type ReportExportJob = z.infer<typeof reportExportJobSchema>;

export const reportExportListSchema = z.object({ items: z.array(reportExportJobSchema) });

/** `POST /admin/system/jobs/{name}/run`. */
export const runJobRequestSchema = z.object({ reason: overrideReasonSchema });
export type RunJobRequest = z.input<typeof runJobRequestSchema>;
