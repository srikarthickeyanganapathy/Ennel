import { type Dashboard, dashboardSchema } from '@ennel/shared';
import { apiRequest } from '@/shared/api-client/api-client';

export const getDashboard = (date?: string): Promise<Dashboard> =>
  apiRequest('/dashboard', { query: { date }, schema: dashboardSchema });
