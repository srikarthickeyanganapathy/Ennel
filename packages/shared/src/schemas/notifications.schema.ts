import { z } from 'zod';
import { NotificationCategory } from '../enums/notification.js';
import { paginatedResponseSchema, uuidSchema } from './common.schema.js';

export const notificationCategorySchema = z.enum(NotificationCategory);

/** One row in the notification centre (Spec §13). */
export const notificationSchema = z.object({
  id: uuidSchema,
  category: notificationCategorySchema,
  title: z.string(),
  body: z.string(),
  /** What the "related action" button opens, e.g. `leave`, `booking`, `complaint`. */
  relatedEntityType: z.string().nullable(),
  relatedEntityId: z.string().nullable(),
  readAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type StudentNotification = z.infer<typeof notificationSchema>;

/** `GET /api/v1/notifications`. `unreadOnly` is text in the query, so only "true" means yes. */
export const notificationListQuerySchema = z.object({
  category: notificationCategorySchema.optional(),
  unreadOnly: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type NotificationListQuery = z.input<typeof notificationListQuerySchema>;

export const notificationListResponseSchema = paginatedResponseSchema(notificationSchema).extend({
  unreadCount: z.number().int(),
});
export type NotificationList = z.infer<typeof notificationListResponseSchema>;

export const unreadCountSchema = z.object({ unreadCount: z.number().int() });

/** `PUT /api/v1/push-tokens`: the device's Expo push token. */
export const registerPushTokenRequestSchema = z.object({
  token: z.string().trim().min(10).max(200),
  platform: z.enum(['ios', 'android', 'web']),
});
export type RegisterPushTokenRequest = z.input<typeof registerPushTokenRequestSchema>;
