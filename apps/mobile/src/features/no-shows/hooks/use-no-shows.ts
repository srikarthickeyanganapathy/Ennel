import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type MealType, type NoShowSummary, type StudentNoShowEvent } from '@ennel/shared';
import { type ApiError } from '@/shared/api-client/api-error';
import { getNoShowSummary, reEnableDefaultBooking, reportNoShow } from '../api/no-shows-api';

export const noShowSummaryKey = ['no-show-summary'] as const;

export function useNoShowSummary() {
  return useQuery<NoShowSummary, ApiError>({
    queryKey: noShowSummaryKey,
    queryFn: getNoShowSummary,
  });
}

export function useReportNoShow() {
  const queryClient = useQueryClient();
  return useMutation<StudentNoShowEvent, ApiError, { eventId: string; message: string }>({
    mutationFn: ({ eventId, message }) => reportNoShow(eventId, message),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: noShowSummaryKey }),
  });
}

/** Turning a meal back on re-books upcoming days, so Home and Default Booking are refreshed. */
export function useReEnableDefaultBooking() {
  const queryClient = useQueryClient();
  return useMutation<NoShowSummary, ApiError, MealType>({
    mutationFn: (mealType) => reEnableDefaultBooking(mealType),
    onSuccess: (summary) => {
      queryClient.setQueryData(noShowSummaryKey, summary);
      void queryClient.invalidateQueries({ queryKey: ['default-preferences'] });
      void queryClient.invalidateQueries({ queryKey: ['day'] });
    },
  });
}
