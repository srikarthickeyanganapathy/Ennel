import { z } from 'zod';
import { ComplaintCategory, ComplaintStatus, ComplaintType } from '../../enums/complaint.js';
import { ComplaintPrivacyMode } from '../../enums/policy.js';
import {
  businessDateSchema,
  paginatedResponseSchema,
  paginationQuerySchema,
  uuidSchema,
} from '../common.schema.js';
import { mealTypeSchema } from '../meal-config.schema.js';

/** Null in anonymous mode: identity is neither stored nor returned (ADR-0008). */
const submitterSchema = z
  .object({
    id: uuidSchema,
    fullName: z.string(),
    referenceNumber: z.string(),
    blockName: z.string().nullable(),
  })
  .nullable();

export const adminComplaintSchema = z.object({
  id: uuidSchema,
  referenceCode: z.string(),
  type: z.enum(ComplaintType),
  category: z.enum(ComplaintCategory),
  mealType: mealTypeSchema.nullable(),
  mealDate: businessDateSchema.nullable(),
  description: z.string(),
  status: z.enum(ComplaintStatus),
  response: z.string().nullable(),
  privacyMode: z.enum(ComplaintPrivacyMode),
  submitter: submitterSchema,
  assignedTo: z.object({ id: uuidSchema, fullName: z.string() }).nullable(),
  photoCount: z.number().int(),
  version: z.number().int(),
  createdAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
});
export type AdminComplaint = z.infer<typeof adminComplaintSchema>;

export const adminComplaintDetailSchema = adminComplaintSchema.extend({
  /** Short-lived signed links (Admin §L "photo viewing via signed URLs"). */
  photos: z.array(z.object({ id: uuidSchema, url: z.string() })),
  /** Never returned by the student API (BR-CMP-1). */
  notes: z.array(
    z.object({
      id: uuidSchema,
      body: z.string(),
      authorName: z.string(),
      createdAt: z.iso.datetime(),
    }),
  ),
  history: z.array(
    z.object({
      fromStatus: z.enum(ComplaintStatus).nullable(),
      toStatus: z.enum(ComplaintStatus),
      actorName: z.string().nullable(),
      createdAt: z.iso.datetime(),
    }),
  ),
});
export type AdminComplaintDetail = z.infer<typeof adminComplaintDetailSchema>;

export const adminComplaintListQuerySchema = paginationQuerySchema.extend({
  type: z.enum(ComplaintType).optional(),
  category: z.enum(ComplaintCategory).optional(),
  mealType: mealTypeSchema.optional(),
  status: z.enum(ComplaintStatus).optional(),
  from: businessDateSchema.optional(),
  to: businessDateSchema.optional(),
  hostelBlockId: uuidSchema.optional(),
  assignedToMe: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});
export type AdminComplaintListQuery = z.input<typeof adminComplaintListQuerySchema>;
export const adminComplaintListResponseSchema = paginatedResponseSchema(adminComplaintSchema);
export type AdminComplaintList = z.infer<typeof adminComplaintListResponseSchema>;

/** BR-CMP-4. A reply is required when closing, so the student is never left without one. */
export const changeComplaintStatusRequestSchema = z
  .object({
    status: z.enum(ComplaintStatus),
    response: z.string().trim().max(2000).optional(),
    version: z.number().int().min(1),
  })
  .refine(
    (body) => (body.status !== 'RESOLVED' && body.status !== 'REJECTED') || Boolean(body.response),
    { message: 'Write a reply for the student', path: ['response'] },
  );
export type ChangeComplaintStatusRequest = z.input<typeof changeComplaintStatusRequestSchema>;

export const assignComplaintRequestSchema = z.object({
  staffId: uuidSchema.nullable(),
  version: z.number().int().min(1),
});
export const addComplaintNoteRequestSchema = z.object({
  body: z.string().trim().min(1, 'Write a note').max(2000),
});

export const complaintAnalyticsQuerySchema = z.object({
  from: businessDateSchema,
  to: businessDateSchema,
});
/** Admin §L "category/meal quality analytics" and §O resolution time. */
export const complaintAnalyticsSchema = z.object({
  total: z.number().int(),
  byCategory: z.array(z.object({ category: z.enum(ComplaintCategory), count: z.number().int() })),
  byMeal: z.array(z.object({ mealType: mealTypeSchema.nullable(), count: z.number().int() })),
  byStatus: z.array(z.object({ status: z.enum(ComplaintStatus), count: z.number().int() })),
  /** Average hours from submission to Resolved or Rejected; null when nothing is closed yet. */
  averageResolutionHours: z.number().nullable(),
});
export type ComplaintAnalytics = z.infer<typeof complaintAnalyticsSchema>;

/** Staff who can be assigned complaints (those with `complaints:resolve`). */
export const complaintAssigneesSchema = z.object({
  items: z.array(z.object({ id: uuidSchema, fullName: z.string() })),
});
