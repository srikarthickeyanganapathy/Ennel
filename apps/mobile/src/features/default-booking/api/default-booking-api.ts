import {
  type DefaultPreferences,
  defaultPreferencesSchema,
  type MealType,
  type SaveDefaultPreferencesRequest,
  type SaveDefaultPreferencesResponse,
  saveDefaultPreferencesResponseSchema,
  type UpdateMealPreferenceRequest,
} from '@ennel/shared';
import { apiRequest } from '@/shared/api-client/api-client';

export function getDefaultPreferences(): Promise<DefaultPreferences> {
  return apiRequest('/api/v1/default-preferences', { schema: defaultPreferencesSchema });
}

/** Spec §8.3 and the overall switch: all three meals together. */
export function saveDefaultPreferences(
  body: SaveDefaultPreferencesRequest,
): Promise<SaveDefaultPreferencesResponse> {
  return apiRequest('/api/v1/default-preferences', {
    method: 'PUT',
    body,
    schema: saveDefaultPreferencesResponseSchema,
  });
}

/** Spec §8.2 "Save Changes": one meal only. */
export function updateMealPreference(
  mealType: MealType,
  body: UpdateMealPreferenceRequest,
): Promise<SaveDefaultPreferencesResponse> {
  return apiRequest(`/api/v1/default-preferences/${mealType}`, {
    method: 'PATCH',
    body,
    schema: saveDefaultPreferencesResponseSchema,
  });
}
