import {
  type MealType,
  type NoShowSummary,
  noShowSummarySchema,
  type StudentNoShowEvent,
  studentNoShowEventSchema,
} from '@ennel/shared';
import { apiRequest } from '@/shared/api-client/api-client';

export function getNoShowSummary(): Promise<NoShowSummary> {
  return apiRequest('/api/v1/no-shows/summary', { schema: noShowSummarySchema });
}

/** Spec §7 "report a possible attendance-system error"; one report per No-show. */
export function reportNoShow(eventId: string, message: string): Promise<StudentNoShowEvent> {
  return apiRequest(`/api/v1/no-shows/${eventId}/appeals`, {
    method: 'POST',
    body: { message },
    schema: studentNoShowEventSchema,
  });
}

export function reEnableDefaultBooking(mealType: MealType): Promise<NoShowSummary> {
  return apiRequest(`/api/v1/no-shows/meals/${mealType}/re-enable`, {
    method: 'POST',
    schema: noShowSummarySchema,
  });
}
