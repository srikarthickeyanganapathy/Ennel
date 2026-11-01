import {
  type Dashboard,
  dashboardSchema,
  type PendingWork,
  pendingWorkSchema,
} from '@ennel/shared';
import { apiRequest } from '@/shared/api-client/api-client';

export const getDashboard = (date?: string): Promise<Dashboard> =>
  apiRequest('/dashboard', { query: { date }, schema: dashboardSchema });

/** Sidebar badges: pending-work counts without the rest of the dashboard. */
export const getPendingWork = (): Promise<PendingWork> =>
  apiRequest('/dashboard/pending', { schema: pendingWorkSchema });
