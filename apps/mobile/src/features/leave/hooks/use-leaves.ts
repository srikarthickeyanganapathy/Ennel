import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import {
  type ApplyLeaveRequest,
  type EndLeaveRequest,
  type ExtendLeaveRequest,
  type Leave,
  type LeavePreview,
  type LeaveResult,
  type LeavesResponse,
} from '@ennel/shared';
import { type ApiError, ClientErrorCode } from '@/shared/api-client/api-error';
import { createIdempotencyKey } from '@/shared/utils/idempotency-key';
import {
  applyLeave,
  endLeave,
  extendLeave,
  getLeave,
  getLeaves,
  previewLeave,
} from '../api/leave-api';

export const leavesKey = ['leaves'] as const;

export function useLeaves() {
  return useQuery<LeavesResponse, ApiError>({ queryKey: leavesKey, queryFn: getLeaves });
}

export function useLeave(id: string) {
  return useQuery<Leave, ApiError>({ queryKey: ['leaves', id], queryFn: () => getLeave(id) });
}

/** The live summary (Spec §11.1); only asked once both ends are chosen. */
export function useLeavePreview(request: ApplyLeaveRequest | null) {
  return useQuery<LeavePreview, ApiError>({
    queryKey: ['leave-preview', request],
    queryFn: () => previewLeave(request as ApplyLeaveRequest),
    enabled: request !== null,
  });
}

/** Leave pauses and resumes bookings, so Home's cards are refreshed too. */
function refresh(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: leavesKey });
  void queryClient.invalidateQueries({ queryKey: ['day'] });
  void queryClient.invalidateQueries({ queryKey: ['booking-history'] });
}

/** Keeps the idempotency key while the outcome is unknown (network error), like booking writes. */
export function useApplyLeave() {
  const queryClient = useQueryClient();
  const key = useRef<string | null>(null);
  return useMutation<LeaveResult, ApiError, ApplyLeaveRequest>({
    mutationFn: (body) => {
      key.current ??= createIdempotencyKey();
      return applyLeave(body, key.current);
    },
    onSuccess: () => {
      key.current = null;
      refresh(queryClient);
    },
    onError: (error) => {
      if (error.code !== ClientErrorCode.NETWORK_ERROR) key.current = null;
    },
  });
}

export function useExtendLeave() {
  const queryClient = useQueryClient();
  return useMutation<LeaveResult, ApiError, { id: string; body: ExtendLeaveRequest }>({
    mutationFn: ({ id, body }) => extendLeave(id, body),
    onSuccess: () => refresh(queryClient),
  });
}

export function useEndLeave() {
  const queryClient = useQueryClient();
  return useMutation<LeaveResult, ApiError, { id: string; body: EndLeaveRequest }>({
    mutationFn: ({ id, body }) => endLeave(id, body),
    onSuccess: () => refresh(queryClient),
  });
}
