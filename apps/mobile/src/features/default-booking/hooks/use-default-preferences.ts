import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type DefaultPreferences,
  type MealType,
  type SaveDefaultPreferencesRequest,
  type SaveDefaultPreferencesResponse,
  type UpdateMealPreferenceRequest,
} from '@ennel/shared';
import { type ApiError } from '@/shared/api-client/api-error';
import {
  getDefaultPreferences,
  saveDefaultPreferences,
  updateMealPreference,
} from '../api/default-booking-api';

export const defaultPreferencesKey = ['default-preferences'] as const;

export function useDefaultPreferences() {
  return useQuery<DefaultPreferences, ApiError>({
    queryKey: defaultPreferencesKey,
    queryFn: getDefaultPreferences,
  });
}

/** Saving also moves upcoming default bookings (BR-DEF-3), so Home's cards are refreshed too. */
function applySaved(queryClient: QueryClient, result: SaveDefaultPreferencesResponse): void {
  queryClient.setQueryData(defaultPreferencesKey, result.preferences);
  void queryClient.invalidateQueries({ queryKey: ['day'] });
  void queryClient.invalidateQueries({ queryKey: ['slot-availability'] });
}

export function useSaveDefaultPreferences() {
  const queryClient = useQueryClient();
  return useMutation<SaveDefaultPreferencesResponse, ApiError, SaveDefaultPreferencesRequest>({
    mutationFn: (body) => saveDefaultPreferences(body),
    onSuccess: (result) => applySaved(queryClient, result),
  });
}

export function useUpdateMealPreference() {
  const queryClient = useQueryClient();
  return useMutation<
    SaveDefaultPreferencesResponse,
    ApiError,
    { mealType: MealType; body: UpdateMealPreferenceRequest }
  >({
    mutationFn: ({ mealType, body }) => updateMealPreference(mealType, body),
    onSuccess: (result) => applySaved(queryClient, result),
  });
}
