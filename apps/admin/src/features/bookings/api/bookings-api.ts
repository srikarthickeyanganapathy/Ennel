import {
  type AdminBooking,
  type AdminBookingListQuery,
  adminBookingPageSchema,
  adminBookingSchema,
  type AdminCancelBookingRequest,
  type AdminCorrectStatusRequest,
  type AdminCreateBookingRequest,
  type AdminMoveBookingRequest,
  type BulkBookingApplyRequest,
  type BulkBookingPreviewRequest,
  type BulkBookingResult,
  bulkBookingResultSchema,
  type Paginated,
} from '@ennel/shared';
import { apiRequest } from '@/shared/api-client/api-client';

export const listBookings = (query: AdminBookingListQuery): Promise<Paginated<AdminBooking>> =>
  apiRequest('/bookings', { query: { ...query }, schema: adminBookingPageSchema });

export const createBooking = (body: AdminCreateBookingRequest): Promise<AdminBooking> =>
  apiRequest('/bookings', { method: 'POST', body, schema: adminBookingSchema });

export const cancelBooking = (id: string, body: AdminCancelBookingRequest): Promise<AdminBooking> =>
  apiRequest(`/bookings/${id}/cancel`, { method: 'POST', body, schema: adminBookingSchema });

export const moveBooking = (id: string, body: AdminMoveBookingRequest): Promise<AdminBooking> =>
  apiRequest(`/bookings/${id}/move`, { method: 'POST', body, schema: adminBookingSchema });

export const correctBookingStatus = (
  id: string,
  body: AdminCorrectStatusRequest,
): Promise<AdminBooking> =>
  apiRequest(`/bookings/${id}/correct-status`, {
    method: 'POST',
    body,
    schema: adminBookingSchema,
  });

export const previewBulkBookings = (body: BulkBookingPreviewRequest): Promise<BulkBookingResult> =>
  apiRequest('/bookings/bulk/preview', { method: 'POST', body, schema: bulkBookingResultSchema });

export const applyBulkBookings = (body: BulkBookingApplyRequest): Promise<BulkBookingResult> =>
  apiRequest('/bookings/bulk/apply', { method: 'POST', body, schema: bulkBookingResultSchema });
