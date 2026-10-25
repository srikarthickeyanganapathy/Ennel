import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type CreateWeekdayRulesRequest,
  type UpdateWeekdayRuleRequest,
  type WeekdayRule,
  type WeekdayRuleResult,
} from '@ennel/shared';
import { type ApiError } from '@/shared/api-client/api-error';
import {
  createWeekdayRules,
  deleteWeekdayRule,
  listWeekdayRules,
  updateWeekdayRule,
} from '../api/weekday-rules-api';

export const weekdayRulesKey = ['weekday-rules'] as const;

export function useWeekdayRules() {
  return useQuery<WeekdayRule[], ApiError>({
    queryKey: weekdayRulesKey,
    queryFn: listWeekdayRules,
  });
}

/** Rules move upcoming bookings (BR-PLAN-3), so Home's cards and slot counts are refreshed. */
function applyResult(queryClient: QueryClient, result: WeekdayRuleResult): void {
  queryClient.setQueryData(weekdayRulesKey, result.items);
  void queryClient.invalidateQueries({ queryKey: ['day'] });
  void queryClient.invalidateQueries({ queryKey: ['slot-availability'] });
}

export function useCreateWeekdayRules() {
  const queryClient = useQueryClient();
  return useMutation<WeekdayRuleResult, ApiError, CreateWeekdayRulesRequest>({
    mutationFn: (body) => createWeekdayRules(body),
    onSuccess: (result) => applyResult(queryClient, result),
  });
}

export function useUpdateWeekdayRule() {
  const queryClient = useQueryClient();
  return useMutation<WeekdayRuleResult, ApiError, { id: string; body: UpdateWeekdayRuleRequest }>({
    mutationFn: ({ id, body }) => updateWeekdayRule(id, body),
    onSuccess: (result) => applyResult(queryClient, result),
  });
}

export function useDeleteWeekdayRule() {
  const queryClient = useQueryClient();
  return useMutation<WeekdayRuleResult, ApiError, { id: string; version: number }>({
    mutationFn: ({ id, version }) => deleteWeekdayRule(id, version),
    onSuccess: (result) => applyResult(queryClient, result),
  });
}
