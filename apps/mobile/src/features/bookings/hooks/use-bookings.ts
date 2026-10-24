import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import {
  type BookMealRequest,
  type BusinessDate,
  type CancelEligibleResponse,
  type ChangeBookingRequest,
  type DayResponse,
  type MealCard,
} from '@ennel/shared';
import { type ApiError, ClientErrorCode } from '@/shared/api-client/api-error';
import { createIdempotencyKey } from '@/shared/utils/idempotency-key';
import {
  bookMeal,
  cancelBooking,
  cancelEligibleMeals,
  changeBooking,
  getDay,
} from '../api/bookings-api';

export const dayKey = (date: BusinessDate) => ['day', date] as const;

/** Home's meal cards; refreshed every minute so deadlines and labels stay current. */
export function useDay(date: BusinessDate) {
  return useQuery<DayResponse, ApiError>({
    queryKey: dayKey(date),
    queryFn: () => getDay(date),
    refetchInterval: 60_000,
  });
}

/** Puts the server's updated card into the cached day and refreshes slot counts. */
function applyCard(queryClient: QueryClient, card: MealCard): void {
  queryClient.setQueryData<DayResponse>(dayKey(card.date), (day) =>
    day
      ? { ...day, meals: day.meals.map((meal) => (meal.mealType === card.mealType ? card : meal)) }
      : day,
  );
  void queryClient.invalidateQueries({ queryKey: ['slot-availability'] });
}

/**
 * One idempotency key per action (ADR-0016): kept while the outcome is unknown (network error),
 * so a retry replays instead of acting twice; dropped after success or a clear refusal.
 */
function useKeyedMutation<TVariables, TResult>(
  send: (variables: TVariables, key: string) => Promise<TResult>,
  onSuccess: (result: TResult) => void,
) {
  const key = useRef<string | null>(null);
  return useMutation<TResult, ApiError, TVariables>({
    mutationFn: (variables) => {
      key.current ??= createIdempotencyKey();
      return send(variables, key.current);
    },
    onSuccess: (result) => {
      key.current = null;
      onSuccess(result);
    },
    onError: (error) => {
      if (error.code !== ClientErrorCode.NETWORK_ERROR) key.current = null;
    },
  });
}

export function useBookMeal() {
  const queryClient = useQueryClient();
  return useKeyedMutation<BookMealRequest, MealCard>(bookMeal, (card) =>
    applyCard(queryClient, card),
  );
}

export function useChangeBooking() {
  const queryClient = useQueryClient();
  return useKeyedMutation<{ bookingId: string; body: ChangeBookingRequest }, MealCard>(
    ({ bookingId, body }, key) => changeBooking(bookingId, body, key),
    (card) => applyCard(queryClient, card),
  );
}

export function useCancelBooking() {
  const queryClient = useQueryClient();
  return useKeyedMutation<{ bookingId: string }, MealCard>(
    ({ bookingId }, key) => cancelBooking(bookingId, key),
    (card) => applyCard(queryClient, card),
  );
}

export function useCancelEligibleMeals() {
  const queryClient = useQueryClient();
  return useKeyedMutation<{ date: BusinessDate }, CancelEligibleResponse>(
    ({ date }, key) => cancelEligibleMeals(date, key),
    (result) => {
      queryClient.setQueryData(dayKey(result.day.date), result.day);
      void queryClient.invalidateQueries({ queryKey: ['slot-availability'] });
    },
  );
}
