import { type Forecast, forecastSchema } from '@ennel/shared';
import { apiRequest, downloadFile } from '@/shared/api-client/api-client';

// Paths are relative to /api/v1/admin, which apiRequest adds.
export const getForecast = (from: string, days: number): Promise<Forecast> =>
  apiRequest('/forecast', { query: { from, days }, schema: forecastSchema });

export const exportKitchenSheet = (
  from: string,
  days: number,
  format: 'pdf' | 'xlsx',
): Promise<void> =>
  downloadFile('/forecast/export', { from, days, format }, `kitchen-sheet-${from}.${format}`);
