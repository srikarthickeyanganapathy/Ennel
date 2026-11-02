import { type SystemHealth, systemHealthSchema } from '@ennel/shared';
import { z } from 'zod';
import { apiRequest } from '@/shared/api-client/api-client';

// Paths are relative to /api/v1/admin, which apiRequest adds.
export const getSystemHealth = (): Promise<SystemHealth> =>
  apiRequest('/system/health', { schema: systemHealthSchema });

export const runJob = (name: string, reason: string): Promise<{ queued: boolean }> =>
  apiRequest(`/system/jobs/${name}/run`, {
    method: 'POST',
    body: { reason },
    schema: z.object({ queued: z.boolean() }),
  });
