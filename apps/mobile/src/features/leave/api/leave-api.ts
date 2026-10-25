import {
  type ApplyLeaveRequest,
  type EndLeaveRequest,
  type ExtendLeaveRequest,
  IDEMPOTENCY_KEY_HEADER,
  type Leave,
  type LeavePreview,
  leavePreviewSchema,
  type LeaveResult,
  leaveResultSchema,
  leaveSchema,
  type LeavesResponse,
  leavesResponseSchema,
} from '@ennel/shared';
import { apiRequest } from '@/shared/api-client/api-client';

export function getLeaves(): Promise<LeavesResponse> {
  return apiRequest('/api/v1/leaves', { schema: leavesResponseSchema });
}

export function getLeave(id: string): Promise<Leave> {
  return apiRequest(`/api/v1/leaves/${id}`, { schema: leaveSchema });
}

export function previewLeave(body: ApplyLeaveRequest): Promise<LeavePreview> {
  return apiRequest('/api/v1/leaves/preview', {
    method: 'POST',
    body,
    schema: leavePreviewSchema,
  });
}

/** One key per submission, so a retry after a network error never creates two leaves (ADR-0016). */
export function applyLeave(body: ApplyLeaveRequest, key: string): Promise<LeaveResult> {
  return apiRequest('/api/v1/leaves', {
    method: 'POST',
    body,
    headers: { [IDEMPOTENCY_KEY_HEADER]: key },
    schema: leaveResultSchema,
  });
}

export function extendLeave(id: string, body: ExtendLeaveRequest): Promise<LeaveResult> {
  return apiRequest(`/api/v1/leaves/${id}/extend`, {
    method: 'POST',
    body,
    schema: leaveResultSchema,
  });
}

export function endLeave(id: string, body: EndLeaveRequest): Promise<LeaveResult> {
  return apiRequest(`/api/v1/leaves/${id}/end`, {
    method: 'POST',
    body,
    schema: leaveResultSchema,
  });
}
