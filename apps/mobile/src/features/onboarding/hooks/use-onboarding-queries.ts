import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type CompleteOnboardingRequest, type StudentProfile } from '@ennel/shared';
import { type ApiError } from '@/shared/api-client/api-error';
import { useSessionStore } from '@/shared/store/session.store';
import {
  completeOnboarding,
  getMyProfile,
  listHostels,
  listMeals,
  type PickedPhoto,
  uploadProfilePhoto,
} from '../api/onboarding-api';

export const ME_QUERY_KEY = ['me'] as const;

export function useMyProfile() {
  return useQuery<StudentProfile, ApiError>({ queryKey: ME_QUERY_KEY, queryFn: getMyProfile });
}

export function useHostels() {
  return useQuery({ queryKey: ['hostels'], queryFn: listHostels, staleTime: 10 * 60_000 });
}

export function useMeals() {
  return useQuery({ queryKey: ['meals'], queryFn: listMeals, staleTime: 10 * 60_000 });
}

export function useUploadPhoto() {
  const queryClient = useQueryClient();
  return useMutation<StudentProfile, ApiError, PickedPhoto>({
    mutationFn: uploadProfilePhoto,
    onSuccess: (profile) => queryClient.setQueryData(ME_QUERY_KEY, profile),
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  const markOnboardingComplete = useSessionStore((state) => state.markOnboardingComplete);
  return useMutation<StudentProfile, ApiError, CompleteOnboardingRequest>({
    mutationFn: completeOnboarding,
    onSuccess: (profile) => {
      queryClient.setQueryData(ME_QUERY_KEY, profile);
      markOnboardingComplete();
    },
  });
}
