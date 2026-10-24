import {
  type BookMealRequest,
  type BusinessDate,
  type CancelEligibleResponse,
  cancelEligibleResponseSchema,
  type ChangeBookingRequest,
  type DayResponse,
  dayResponseSchema,
  IDEMPOTENCY_KEY_HEADER,
  type MealCard,
  mealCardSchema,
} from '@ennel/shared';
import { apiRequest } from '@/shared/api-client/api-client';

const withKey = (key: string) => ({ [IDEMPOTENCY_KEY_HEADER]: key });

export function getDay(date: BusinessDate): Promise<DayResponse> {
  return apiRequest(`/api/v1/days/${date}`, { schema: dayResponseSchema });
}

export function bookMeal(body: BookMealRequest, key: string): Promise<MealCard> {
  return apiRequest('/api/v1/bookings', {
    method: 'POST',
    body,
    headers: withKey(key),
    schema: mealCardSchema,
  });
}

export function changeBooking(
  bookingId: string,
  body: ChangeBookingRequest,
  key: string,
): Promise<MealCard> {
  return apiRequest(`/api/v1/bookings/${bookingId}`, {
    method: 'PATCH',
    body,
    headers: withKey(key),
    schema: mealCardSchema,
  });
}

export function cancelBooking(bookingId: string, key: string): Promise<MealCard> {
  return apiRequest(`/api/v1/bookings/${bookingId}/cancel`, {
    method: 'POST',
    headers: withKey(key),
    schema: mealCardSchema,
  });
}

export function cancelEligibleMeals(
  date: BusinessDate,
  key: string,
): Promise<CancelEligibleResponse> {
  return apiRequest(`/api/v1/days/${date}/cancel-eligible`, {
    method: 'POST',
    headers: withKey(key),
    schema: cancelEligibleResponseSchema,
  });
}
