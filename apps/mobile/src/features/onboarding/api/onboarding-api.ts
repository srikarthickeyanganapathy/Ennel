import {
  type CompleteOnboardingRequest,
  type HostelOption,
  hostelListResponseSchema,
  type MealConfig,
  mealConfigListResponseSchema,
  type StudentProfile,
  studentProfileSchema,
} from '@ennel/shared';
import { apiRequest } from '@/shared/api-client/api-client';

export function getMyProfile(): Promise<StudentProfile> {
  return apiRequest('/api/v1/me', { schema: studentProfileSchema });
}

export async function listHostels(): Promise<HostelOption[]> {
  return (await apiRequest('/api/v1/hostels', { schema: hostelListResponseSchema })).items;
}

export async function listMeals(): Promise<MealConfig[]> {
  return (await apiRequest('/api/v1/meals', { schema: mealConfigListResponseSchema })).items;
}

export function completeOnboarding(body: CompleteOnboardingRequest): Promise<StudentProfile> {
  return apiRequest('/api/v1/me/onboarding', { method: 'PUT', body, schema: studentProfileSchema });
}

export interface PickedPhoto {
  uri: string;
  mimeType: string;
  fileName: string;
}

export function uploadProfilePhoto(photo: PickedPhoto): Promise<StudentProfile> {
  const formData = new FormData();
  // React Native's FormData accepts a { uri, name, type } descriptor for files.
  formData.append('photo', {
    uri: photo.uri,
    name: photo.fileName,
    type: photo.mimeType,
  } as unknown as Blob);
  return apiRequest('/api/v1/me/photo', { method: 'PUT', formData, schema: studentProfileSchema });
}
