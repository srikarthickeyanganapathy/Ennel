import {
  type AdminComplaint,
  type AdminComplaintDetail,
  adminComplaintDetailSchema,
  type AdminComplaintList,
  type AdminComplaintListQuery,
  adminComplaintListResponseSchema,
  adminComplaintSchema,
  type ChangeComplaintStatusRequest,
  type ComplaintAnalytics,
  complaintAnalyticsSchema,
  complaintAssigneesSchema,
} from '@ennel/shared';
import { z } from 'zod';
import { apiRequest } from '@/shared/api-client/api-client';

// Paths are relative to /api/v1/admin, which apiRequest adds.
export const listComplaints = (query: AdminComplaintListQuery): Promise<AdminComplaintList> =>
  apiRequest('/complaints', { query: { ...query }, schema: adminComplaintListResponseSchema });

export const getComplaint = (id: string): Promise<AdminComplaintDetail> =>
  apiRequest(`/complaints/${id}`, { schema: adminComplaintDetailSchema });

export const changeComplaintStatus = (
  id: string,
  body: ChangeComplaintStatusRequest,
): Promise<AdminComplaint> =>
  apiRequest(`/complaints/${id}/status`, { method: 'POST', body, schema: adminComplaintSchema });

export const assignComplaint = (
  id: string,
  staffId: string | null,
  version: number,
): Promise<AdminComplaint> =>
  apiRequest(`/complaints/${id}/assign`, {
    method: 'POST',
    body: { staffId, version },
    schema: adminComplaintSchema,
  });

export const addComplaintNote = (id: string, body: string): Promise<{ id: string }> =>
  apiRequest(`/complaints/${id}/notes`, {
    method: 'POST',
    body: { body },
    schema: z.object({ id: z.string() }),
  });

export const listAssignees = async (): Promise<{ id: string; fullName: string }[]> =>
  (await apiRequest('/complaints/assignees', { schema: complaintAssigneesSchema })).items;

export const getComplaintAnalytics = (from: string, to: string): Promise<ComplaintAnalytics> =>
  apiRequest('/complaints/analytics', { query: { from, to }, schema: complaintAnalyticsSchema });
