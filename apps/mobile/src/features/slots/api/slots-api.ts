import {
  type SlotAvailabilityQuery,
  type SlotAvailabilityResponse,
  slotAvailabilityResponseSchema,
} from '@ennel/shared';
import { apiRequest } from '@/shared/api-client/api-client';

export function getSlotAvailability(
  query: SlotAvailabilityQuery,
): Promise<SlotAvailabilityResponse> {
  const params = new URLSearchParams({ date: query.date, meal: query.meal });
  return apiRequest(`/api/v1/slots/availability?${params.toString()}`, {
    schema: slotAvailabilityResponseSchema,
  });
}
