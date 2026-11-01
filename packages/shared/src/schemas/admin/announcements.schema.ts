import { z } from 'zod';
import { paginatedResponseSchema, paginationQuerySchema, uuidSchema } from '../common.schema.js';

export const ANNOUNCEMENT_STATUSES = [
  'DRAFT',
  'SCHEDULED',
  'SENDING',
  'SENT',
  'CANCELLED',
] as const;
export const ANNOUNCEMENT_AUDIENCES = [
  'ALL',
  'HOSTEL',
  'BLOCK',
  'ACADEMIC_YEAR',
  'CUSTOM',
] as const;
export const ANNOUNCEMENT_CHANNELS = ['IN_APP', 'PUSH'] as const;
export const ANNOUNCEMENT_CATEGORIES = ['GENERAL', 'MENU', 'TIMING', 'EVENT', 'URGENT'] as const;

/**
 * Admin §M audience. The ids that apply depend on the type; the API checks that the chosen
 * type has at least one target (e.g. a hostel for HOSTEL).
 */
export const announcementAudienceSchema = z.object({
  type: z.enum(ANNOUNCEMENT_AUDIENCES),
  hostelIds: z.array(uuidSchema).max(50).default([]),
  blockIds: z.array(uuidSchema).max(200).default([]),
  academicYears: z.array(z.number().int().min(1).max(10)).max(10).default([]),
  /** Reference numbers for a custom list. */
  referenceNumbers: z.array(z.string().trim().min(1).max(32)).max(5000).default([]),
});
export type AnnouncementAudience = z.input<typeof announcementAudienceSchema>;

const announcementContentSchema = z.object({
  title: z.string().trim().min(3, 'Give it a short title').max(120),
  body: z.string().trim().min(3, 'Write the message').max(4000),
  category: z.enum(ANNOUNCEMENT_CATEGORIES),
  audience: announcementAudienceSchema,
  channels: z
    .array(z.enum(ANNOUNCEMENT_CHANNELS))
    .min(1, 'Choose at least one channel')
    .refine((channels) => channels.includes('IN_APP'), {
      message: 'In-app is always included so the full message can be read',
    }),
});

export const createAnnouncementRequestSchema = announcementContentSchema;
export type CreateAnnouncementRequest = z.input<typeof createAnnouncementRequestSchema>;

export const updateAnnouncementRequestSchema = announcementContentSchema.extend({
  version: z.number().int().min(1),
});
export type UpdateAnnouncementRequest = z.input<typeof updateAnnouncementRequestSchema>;

export const scheduleAnnouncementRequestSchema = z.object({
  scheduledFor: z.iso.datetime(),
  version: z.number().int().min(1),
});
export const announcementVersionRequestSchema = z.object({ version: z.number().int().min(1) });

export const announcementSchema = z.object({
  id: uuidSchema,
  title: z.string(),
  body: z.string(),
  category: z.enum(ANNOUNCEMENT_CATEGORIES),
  audience: z.object({
    type: z.enum(ANNOUNCEMENT_AUDIENCES),
    hostelIds: z.array(uuidSchema),
    blockIds: z.array(uuidSchema),
    academicYears: z.array(z.number().int()),
    referenceNumbers: z.array(z.string()),
  }),
  channels: z.array(z.enum(ANNOUNCEMENT_CHANNELS)),
  status: z.enum(ANNOUNCEMENT_STATUSES),
  scheduledFor: z.iso.datetime().nullable(),
  sentAt: z.iso.datetime().nullable(),
  createdByName: z.string(),
  version: z.number().int(),
  createdAt: z.iso.datetime(),
  /** Admin §M delivery counts, per channel. */
  deliveries: z.object({
    inApp: z.number().int(),
    pushSent: z.number().int(),
    pushFailed: z.number().int(),
  }),
});
export type Announcement = z.infer<typeof announcementSchema>;

export const announcementListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(ANNOUNCEMENT_STATUSES).optional(),
});
export type AnnouncementListQuery = z.input<typeof announcementListQuerySchema>;
export const announcementListResponseSchema = paginatedResponseSchema(announcementSchema);
export type AnnouncementList = z.infer<typeof announcementListResponseSchema>;

/** `POST /admin/announcements/audience-preview`: how many students would receive it. */
export const audiencePreviewSchema = z.object({
  recipients: z.number().int(),
  /** Custom-list reference numbers that match no active student. */
  unknownReferenceNumbers: z.array(z.string()),
});
export type AudiencePreview = z.infer<typeof audiencePreviewSchema>;
