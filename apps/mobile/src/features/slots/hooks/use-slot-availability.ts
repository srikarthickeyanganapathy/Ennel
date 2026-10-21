import { useQuery } from '@tanstack/react-query';
import { type BusinessDate, type MealType, type SlotAvailabilityResponse } from '@ennel/shared';
import { type ApiError } from '@/shared/api-client/api-error';
import { getSlotAvailability } from '../api/slots-api';

/** Counts change as other students book, so the screen refreshes while it is open (Spec §5.1). */
export const SLOT_REFRESH_MS = 30_000;

export function slotAvailabilityKey(date: BusinessDate, meal: MealType) {
  return ['slot-availability', date, meal] as const;
}

export function useSlotAvailability(date: BusinessDate, meal: MealType) {
  return useQuery<SlotAvailabilityResponse, ApiError>({
    queryKey: slotAvailabilityKey(date, meal),
    queryFn: () => getSlotAvailability({ date, meal }),
    refetchInterval: SLOT_REFRESH_MS,
  });
}
