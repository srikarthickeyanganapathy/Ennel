import { z } from 'zod';
import { outageWindowSchema } from './attendance.schema.js';

export const jobRunSummarySchema = z.object({
  status: z.enum(['RUNNING', 'SUCCEEDED', 'FAILED']),
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
  attempt: z.number().int(),
  error: z.string().nullable(),
});
export type JobRunSummary = z.infer<typeof jobRunSummarySchema>;

/** `GET /admin/system/health` (Admin §Q). The config summary never carries secrets. */
export const systemHealthSchema = z.object({
  generatedAt: z.iso.datetime(),
  version: z.string(),
  environment: z.string(),
  timeZone: z.string(),
  pushProvider: z.string(),
  database: z.enum(['up', 'down']),
  queue: z.object({
    isAvailable: z.boolean(),
    waiting: z.number().int(),
    active: z.number().int(),
    delayed: z.number().int(),
    failed: z.number().int(),
  }),
  jobs: z.array(
    z.object({
      name: z.string(),
      label: z.string(),
      schedule: z.string(),
      lastRun: jobRunSummarySchema.nullable(),
      nextRunAt: z.iso.datetime().nullable(),
      failuresLast7Days: z.number().int(),
    }),
  ),
  attendanceProvider: z.object({ name: z.string(), isConfigured: z.boolean() }),
  outage: outageWindowSchema.nullable(),
});
export type SystemHealth = z.infer<typeof systemHealthSchema>;
