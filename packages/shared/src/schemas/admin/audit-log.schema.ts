import { z } from 'zod';
import { paginationQuerySchema } from '../common.schema.js';

/** Admin §P audit viewer filters. */
export const auditLogQuerySchema = paginationQuerySchema.extend({
  actorId: z.uuid().optional(),
  entityType: z.string().trim().max(60).optional(),
  entityId: z.string().trim().max(60).optional(),
  action: z.string().trim().max(100).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  isOverride: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});
export type AuditLogQuery = z.input<typeof auditLogQuerySchema>;

export const auditLogItemSchema = z.object({
  id: z.uuid(),
  actorId: z.uuid().nullable(),
  actorName: z.string().nullable(),
  actorType: z.string(),
  actorRoles: z.array(z.string()),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  before: z.unknown(),
  after: z.unknown(),
  reason: z.string().nullable(),
  isOverride: z.boolean(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  requestId: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type AuditLogItem = z.infer<typeof auditLogItemSchema>;
