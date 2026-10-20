import { useCallback, useState } from 'react';

export interface TableState {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
}

/** Server-side paging and sorting state for one DataTable; changing a filter resets to page 1. */
export function useTableState(initialPageSize = 20) {
  const [state, setState] = useState<TableState>({
    page: 1,
    pageSize: initialPageSize,
    sortOrder: 'asc',
  });
  const setPage = useCallback((page: number) => setState((current) => ({ ...current, page })), []);
  const setPageSize = useCallback(
    (pageSize: number) => setState((current) => ({ ...current, pageSize, page: 1 })),
    [],
  );
  const setSort = useCallback(
    (sortBy: string | undefined, sortOrder: 'asc' | 'desc') =>
      setState((current) => ({ ...current, sortBy, sortOrder, page: 1 })),
    [],
  );
  const resetPage = useCallback(() => setState((current) => ({ ...current, page: 1 })), []);
  return { state, setPage, setPageSize, setSort, resetPage };
}
