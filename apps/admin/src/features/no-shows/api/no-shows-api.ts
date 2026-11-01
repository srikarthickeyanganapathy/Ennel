import {
  type AdminNoShowList,
  type AdminNoShowListQuery,
  adminNoShowListResponseSchema,
  type MealType,
  type NoShowActionResult,
  noShowActionResultSchema,
} from '@ennel/shared';
import { apiRequest } from '@/shared/api-client/api-client';

// Paths are relative to /api/v1/admin, which apiRequest adds.
export const listNoShows = (query: AdminNoShowListQuery): Promise<AdminNoShowList> =>
  apiRequest('/no-shows', { query: { ...query }, schema: adminNoShowListResponseSchema });

const post = (path: string, body: object): Promise<NoShowActionResult> =>
  apiRequest(path, { method: 'POST', body, schema: noShowActionResultSchema });

export const approveAppeal = (appealId: string) => post(`/no-show-appeals/${appealId}/approve`, {});

export const rejectAppeal = (appealId: string, reason: string) =>
  post(`/no-show-appeals/${appealId}/reject`, { reason });

export const reviewHeld = (eventId: string, decision: 'confirm' | 'dismiss', reason: string) =>
  post(`/no-shows/${eventId}/${decision}`, { reason });

export const resetCount = (studentId: string, mealType: MealType, reason: string) =>
  post(`/students/${studentId}/no-shows/reset`, { mealType, reason });

export const reEnableDefaultBooking = (studentId: string, mealType: MealType, reason: string) =>
  post(`/students/${studentId}/default-booking/re-enable`, { mealType, reason });
