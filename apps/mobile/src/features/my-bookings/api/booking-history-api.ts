import {
  type BookingHistoryQuery,
  type BookingHistoryResponse,
  bookingHistoryResponseSchema,
  type BookingRecord,
  bookingRecordSchema,
} from '@ennel/shared';
import { apiRequest } from '@/shared/api-client/api-client';

/** Only set filters are sent; the server applies its own defaults for the rest. */
function toQueryString(query: BookingHistoryQuery): string {
  const parts = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export function getBookingHistory(query: BookingHistoryQuery): Promise<BookingHistoryResponse> {
  return apiRequest(`/api/v1/bookings/history${toQueryString(query)}`, {
    schema: bookingHistoryResponseSchema,
  });
}

export function getBookingRecord(id: string): Promise<BookingRecord> {
  return apiRequest(`/api/v1/bookings/${id}/record`, { schema: bookingRecordSchema });
}
