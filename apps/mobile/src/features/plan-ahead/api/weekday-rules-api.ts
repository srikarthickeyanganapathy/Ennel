import {
  type CreateWeekdayRulesRequest,
  type UpdateWeekdayRuleRequest,
  type WeekdayRule,
  type WeekdayRuleResult,
  weekdayRuleResultSchema,
  weekdayRulesResponseSchema,
} from '@ennel/shared';
import { apiRequest } from '@/shared/api-client/api-client';

export async function listWeekdayRules(): Promise<WeekdayRule[]> {
  return (await apiRequest('/api/v1/weekday-rules', { schema: weekdayRulesResponseSchema })).items;
}

export function createWeekdayRules(body: CreateWeekdayRulesRequest): Promise<WeekdayRuleResult> {
  return apiRequest('/api/v1/weekday-rules', {
    method: 'POST',
    body,
    schema: weekdayRuleResultSchema,
  });
}

export function updateWeekdayRule(
  id: string,
  body: UpdateWeekdayRuleRequest,
): Promise<WeekdayRuleResult> {
  return apiRequest(`/api/v1/weekday-rules/${id}`, {
    method: 'PATCH',
    body,
    schema: weekdayRuleResultSchema,
  });
}

/** The version shown is sent so a rule changed on another device is not deleted by mistake. */
export function deleteWeekdayRule(id: string, version: number): Promise<WeekdayRuleResult> {
  return apiRequest(`/api/v1/weekday-rules/${id}?version=${version}`, {
    method: 'DELETE',
    schema: weekdayRuleResultSchema,
  });
}
