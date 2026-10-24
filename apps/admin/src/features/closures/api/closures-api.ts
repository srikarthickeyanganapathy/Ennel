import {
  type AdminClosure,
  type ClosureImpact,
  closureImpactSchema,
  closureListResponseSchema,
  type ClosureResult,
  closureResultSchema,
  type CreateClosureRequest,
  type MealType,
} from '@ennel/shared';
import { apiRequest } from '@/shared/api-client/api-client';

export const listClosures = async (includeRemoved: boolean): Promise<AdminClosure[]> =>
  (
    await apiRequest('/admin/closures', {
      query: { includeRemoved: String(includeRemoved) },
      schema: closureListResponseSchema,
    })
  ).items;

export const getClosureImpact = (date: string, mealTypes: MealType[]): Promise<ClosureImpact> =>
  apiRequest('/admin/closures/impact', {
    query: { date, mealTypes: mealTypes.join(',') },
    schema: closureImpactSchema,
  });

export const createClosure = (body: CreateClosureRequest): Promise<ClosureResult> =>
  apiRequest('/admin/closures', { method: 'POST', body, schema: closureResultSchema });

export const removeClosure = (id: string, reason: string): Promise<ClosureResult> =>
  apiRequest(`/admin/closures/${id}/remove`, {
    method: 'POST',
    body: { reason },
    schema: closureResultSchema,
  });
