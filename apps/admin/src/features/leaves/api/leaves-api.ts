import {
  type AdminLeaveList,
  adminLeaveListResponseSchema,
  type AdminLeaveListQuery,
  type AdminLeaveResult,
  adminLeaveResultSchema,
  type CorrectLeaveRequest,
  type CreateStaffLeaveRequest,
  type LeaveCalendar,
  leaveCalendarSchema,
  type StaffEndLeaveRequest,
} from '@ennel/shared';
import { apiRequest } from '@/shared/api-client/api-client';

// Paths are relative to /api/v1/admin, which apiRequest adds.
export const listLeaves = (query: AdminLeaveListQuery): Promise<AdminLeaveList> =>
  apiRequest('/leaves', { query: { ...query }, schema: adminLeaveListResponseSchema });

export const approveLeave = (id: string, version: number): Promise<AdminLeaveResult> =>
  apiRequest(`/leaves/${id}/approve`, {
    method: 'POST',
    body: { version },
    schema: adminLeaveResultSchema,
  });

export const rejectLeave = (
  id: string,
  version: number,
  reason: string,
): Promise<AdminLeaveResult> =>
  apiRequest(`/leaves/${id}/reject`, {
    method: 'POST',
    body: { version, reason },
    schema: adminLeaveResultSchema,
  });

export const createLeave = (body: CreateStaffLeaveRequest): Promise<AdminLeaveResult> =>
  apiRequest('/leaves', { method: 'POST', body, schema: adminLeaveResultSchema });

export const endLeave = (id: string, body: StaffEndLeaveRequest): Promise<AdminLeaveResult> =>
  apiRequest(`/leaves/${id}/end`, { method: 'POST', body, schema: adminLeaveResultSchema });

export const correctLeave = (id: string, body: CorrectLeaveRequest): Promise<AdminLeaveResult> =>
  apiRequest(`/leaves/${id}`, { method: 'PATCH', body, schema: adminLeaveResultSchema });

/** Students away per day of a `YYYY-MM` month. */
export const getLeaveCalendar = (month: string): Promise<LeaveCalendar> =>
  apiRequest('/leaves/calendar', { query: { month }, schema: leaveCalendarSchema });
