import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import {
  type ComplaintPrivacyMode,
  type ComplaintReceipt,
  type CreateComplaintRequest,
  type StudentComplaint,
} from '@ennel/shared';
import { type ApiError, ClientErrorCode } from '@/shared/api-client/api-error';
import { createIdempotencyKey } from '@/shared/utils/idempotency-key';
import { useMyProfile } from '@/features/onboarding/hooks/use-onboarding-queries';
import {
  listMyComplaints,
  lookupComplaints,
  type PickedComplaintPhoto,
  submitComplaint,
} from '../api/complaints-api';
import { addReceipt, readReceipts } from '../storage/receipt-storage';

export const complaintsKey = ['complaints'] as const;

export interface MyReports {
  items: StudentComplaint[];
  privacyMode: ComplaintPrivacyMode;
}

/**
 * Spec §12 "My Reports": identified reports from the server plus anonymous ones found with the
 * receipts kept on this phone, newest first.
 */
export function useMyReports() {
  const studentId = useMyProfile().data?.id;
  return useQuery<MyReports, ApiError>({
    queryKey: [...complaintsKey, studentId ?? 'unknown'],
    enabled: Boolean(studentId),
    queryFn: async () => {
      const [mine, receipts] = await Promise.all([
        listMyComplaints(),
        studentId ? readReceipts(studentId) : Promise.resolve([]),
      ]);
      const anonymous = await lookupComplaints(receipts);
      const byId = new Map([...mine.items, ...anonymous].map((item) => [item.id, item]));
      const items = [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return { items, privacyMode: mine.privacyMode };
    },
  });
}

/** Keeps the idempotency key while the outcome is unknown (network error), like booking writes. */
export function useSubmitComplaint() {
  const queryClient = useQueryClient();
  const studentId = useMyProfile().data?.id;
  const key = useRef<string | null>(null);
  return useMutation<
    ComplaintReceipt,
    ApiError,
    { request: CreateComplaintRequest; photos: PickedComplaintPhoto[] }
  >({
    mutationFn: ({ request, photos }) => {
      key.current ??= createIdempotencyKey();
      return submitComplaint(request, photos, key.current);
    },
    onSuccess: async (receipt) => {
      key.current = null;
      if (receipt.receiptToken && studentId) await addReceipt(studentId, receipt.receiptToken);
      void queryClient.invalidateQueries({ queryKey: complaintsKey });
    },
    onError: (error) => {
      if (error.code !== ClientErrorCode.NETWORK_ERROR) key.current = null;
    },
  });
}
