import {
  type AdminHostel,
  adminHostelSchema,
  type AdminMeal,
  adminMealSchema,
  type AdminSlot,
  adminSlotSchema,
  type CapacityImpact,
  type CapacityImpactQuery,
  capacityImpactSchema,
  type CapacityOverride,
  capacityOverrideSchema,
  type CreateSlotRequest,
  type MessPolicyView,
  messPolicySchema,
  type Paginated,
  paginatedResponseSchema,
  type PolicyHistoryItem,
  policyHistoryItemSchema,
  type SlotUsage,
  slotUsageSchema,
  type ThresholdsRequest,
  type UpdateMealRequest,
  type UpdatePolicyRequest,
  type UpdateSlotRequest,
  type WeekdayCapacitiesRequest,
} from '@ennel/shared';
import { z } from 'zod';
import { apiRequest } from '@/shared/api-client/api-client';

const hostelsSchema = z.object({ items: z.array(adminHostelSchema) });

export const listMeals = async (): Promise<AdminMeal[]> =>
  (
    await apiRequest('/mess-config/meals', {
      schema: z.object({ items: z.array(adminMealSchema) }),
    })
  ).items;

export const updateMeal = (id: string, body: UpdateMealRequest): Promise<AdminMeal> =>
  apiRequest(`/mess-config/meals/${id}`, { method: 'PATCH', body, schema: adminMealSchema });

export const createSlot = (body: CreateSlotRequest): Promise<AdminSlot> =>
  apiRequest('/mess-config/slots', { method: 'POST', body, schema: adminSlotSchema });

export const updateSlot = (id: string, body: UpdateSlotRequest): Promise<AdminSlot> =>
  apiRequest(`/mess-config/slots/${id}`, { method: 'PATCH', body, schema: adminSlotSchema });

export const getSlotUsage = (id: string): Promise<SlotUsage> =>
  apiRequest(`/mess-config/slots/${id}/usage`, { schema: slotUsageSchema });

export const disableSlot = (
  id: string,
  reason: string,
  reassignToSlotId?: string,
): Promise<AdminSlot> =>
  apiRequest(`/mess-config/slots/${id}/disable`, {
    method: 'POST',
    body: { reason, reassignToSlotId },
    schema: adminSlotSchema,
  });

export const enableSlot = (id: string, reason: string): Promise<AdminSlot> =>
  apiRequest(`/mess-config/slots/${id}/enable`, {
    method: 'POST',
    body: { reason },
    schema: adminSlotSchema,
  });

export const deleteSlot = (id: string, reason: string): Promise<void> =>
  apiRequest(`/mess-config/slots/${id}`, { method: 'DELETE', body: { reason } });

export const setWeekdayCapacities = (
  id: string,
  body: WeekdayCapacitiesRequest,
): Promise<AdminSlot> =>
  apiRequest(`/mess-config/slots/${id}/weekday-capacities`, {
    method: 'PUT',
    body,
    schema: adminSlotSchema,
  });

export const listOverrides = async (id: string): Promise<CapacityOverride[]> =>
  (
    await apiRequest(`/mess-config/slots/${id}/capacity-overrides`, {
      schema: z.object({ items: z.array(capacityOverrideSchema) }),
    })
  ).items;

export const setOverride = (
  id: string,
  date: string,
  capacity: number,
  reason: string,
): Promise<void> =>
  apiRequest(`/mess-config/slots/${id}/capacity-overrides/${date}`, {
    method: 'PUT',
    body: { capacity, reason },
  });

export const removeOverride = (id: string, date: string, reason: string): Promise<void> =>
  apiRequest(`/mess-config/slots/${id}/capacity-overrides/${date}`, {
    method: 'DELETE',
    body: { reason },
  });

export const getCapacityImpact = (
  id: string,
  query: CapacityImpactQuery,
): Promise<CapacityImpact> =>
  apiRequest(`/mess-config/slots/${id}/capacity-impact`, {
    query: { ...query },
    schema: capacityImpactSchema,
  });

export const updateThresholds = (body: ThresholdsRequest): Promise<MessPolicyView> =>
  apiRequest('/mess-config/thresholds', { method: 'PATCH', body, schema: messPolicySchema });

export const getPolicy = (): Promise<MessPolicyView> =>
  apiRequest('/policy', { schema: messPolicySchema });

export const updatePolicy = (body: UpdatePolicyRequest): Promise<MessPolicyView> =>
  apiRequest('/policy', { method: 'PATCH', body, schema: messPolicySchema });

export const listPolicyHistory = (page: number): Promise<Paginated<PolicyHistoryItem>> =>
  apiRequest('/policy/history', {
    query: { page, pageSize: 20 },
    schema: paginatedResponseSchema(policyHistoryItemSchema),
  });

export const listHostels = async (): Promise<AdminHostel[]> =>
  (await apiRequest('/hostels', { schema: hostelsSchema })).items;

export const createHostel = async (name: string): Promise<AdminHostel[]> =>
  (await apiRequest('/hostels', { method: 'POST', body: { name }, schema: hostelsSchema })).items;

export const updateHostel = async (
  id: string,
  body: { name?: string; isActive?: boolean },
): Promise<AdminHostel[]> =>
  (await apiRequest(`/hostels/${id}`, { method: 'PATCH', body, schema: hostelsSchema })).items;

export const createBlock = async (hostelId: string, name: string): Promise<AdminHostel[]> =>
  (
    await apiRequest(`/hostels/${hostelId}/blocks`, {
      method: 'POST',
      body: { name },
      schema: hostelsSchema,
    })
  ).items;

export const updateBlock = async (
  id: string,
  body: { name?: string; isActive?: boolean },
): Promise<AdminHostel[]> =>
  (await apiRequest(`/hostels/blocks/${id}`, { method: 'PATCH', body, schema: hostelsSchema }))
    .items;
