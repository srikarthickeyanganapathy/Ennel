import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  type BookingHistoryQuery,
  type BookingHistoryResponse,
  type BookingRecord,
} from '@ennel/shared';
import { type ApiError } from '@/shared/api-client/api-error';
import { getBookingHistory, getBookingRecord } from '../api/booking-history-api';

const PAGE_SIZE = 20;

export type HistoryFilters = Omit<BookingHistoryQuery, 'page' | 'pageSize'>;

/** My Bookings pages, loaded with "Load more" (Spec §7). */
export function useBookingHistory(filters: HistoryFilters) {
  return useInfiniteQuery<BookingHistoryResponse, ApiError>({
    queryKey: ['booking-history', filters],
    queryFn: ({ pageParam }) =>
      getBookingHistory({ ...filters, page: pageParam as number, pageSize: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
  });
}

export function useBookingRecord(id: string) {
  return useQuery<BookingRecord, ApiError>({
    queryKey: ['booking-record', id],
    queryFn: () => getBookingRecord(id),
  });
}
