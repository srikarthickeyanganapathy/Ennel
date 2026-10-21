import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table';
import { type ReactNode, useEffect, useState } from 'react';
import { saveCsv, toCsv } from '@/shared/lib/csv';
import { type TableState } from '@/shared/hooks/use-table-state';
import { EmptyState, ErrorState, LoadingState } from './QueryStates';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Select } from './ui/form-controls';

export interface DataTableColumnMeta {
  /** Plain value for CSV export; columns without it are left out of the file. */
  exportValue?: (row: unknown) => string | number | boolean | null | undefined;
}

interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  rows: T[];
  total: number;
  state: TableState;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSortChange?: (sortBy: string | undefined, sortOrder: 'asc' | 'desc') => void;
  getRowId: (row: T) => string;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyTitle?: string;
  exportFileName?: string;
  toolbar?: ReactNode;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  caption: string;
}

/**
 * The shared admin grid (Admin UX standards): server-side pagination and sorting, column
 * visibility, CSV export of the visible page, and loading/empty/error states.
 */
export function DataTable<T>(props: DataTableProps<T>) {
  const { columns, rows, total, state, getRowId, caption } = props;
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const sorting: SortingState = state.sortBy
    ? [{ id: state.sortBy, desc: state.sortOrder === 'desc' }]
    : [];
  const table = useReactTable({
    data: rows,
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    enableRowSelection: Boolean(props.onRowSelectionChange),
    rowCount: total,
    state: { sorting, columnVisibility, rowSelection: props.rowSelection ?? {} },
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: (updater) => {
      const next = typeof updater === 'function' ? updater(props.rowSelection ?? {}) : updater;
      props.onRowSelectionChange?.(next);
    },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      props.onSortChange?.(next[0]?.id, next[0]?.desc ? 'desc' : 'asc');
    },
  });
  const pageCount = Math.max(1, Math.ceil(total / state.pageSize));
  // Rows can disappear under the current page (bulk move, colleague's change); step back to
  // the last page that has rows instead of showing an empty "Page 3 of 2".
  const { isLoading, onPageChange } = props;
  useEffect(() => {
    if (!isLoading && total > 0 && state.page > pageCount) onPageChange(pageCount);
  }, [isLoading, total, state.page, pageCount, onPageChange]);

  const exportPage = () => {
    const exportable = table
      .getVisibleLeafColumns()
      .filter((column) => (column.columnDef.meta as DataTableColumnMeta | undefined)?.exportValue);
    const headers = exportable.map((column) => String(column.columnDef.header ?? column.id));
    const data = rows.map((row) =>
      exportable.map((column) => (column.columnDef.meta as DataTableColumnMeta).exportValue?.(row)),
    );
    saveCsv(props.exportFileName ?? 'export.csv', toCsv(headers, data));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">{props.toolbar}</div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {table
                .getAllLeafColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
                    onSelect={(event) => event.preventDefault()}
                  >
                    {typeof column.columnDef.header === 'string'
                      ? column.columnDef.header
                      : column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {props.exportFileName ? (
            <Button variant="outline" size="sm" onClick={exportPage} disabled={rows.length === 0}>
              Export CSV
            </Button>
          ) : null}
        </div>
      </div>

      {props.isLoading ? (
        <LoadingState />
      ) : props.error ? (
        <ErrorState error={props.error} onRetry={props.onRetry} />
      ) : rows.length === 0 ? (
        <EmptyState title={props.emptyTitle ?? 'Nothing to show'} />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{caption}</caption>
            <thead className="bg-surface">
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => {
                    const sortState = header.column.getIsSorted();
                    const canSort = header.column.getCanSort() && Boolean(props.onSortChange);
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        aria-sort={
                          sortState === 'asc'
                            ? 'ascending'
                            : sortState === 'desc'
                              ? 'descending'
                              : undefined
                        }
                        className="whitespace-nowrap px-3 py-2 font-medium text-muted-foreground"
                      >
                        {canSort ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 hover:text-foreground"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            <span aria-hidden>
                              {sortState === 'asc' ? '▲' : sortState === 'desc' ? '▼' : '↕'}
                            </span>
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-border hover:bg-mint/40"
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          {total} {total === 1 ? 'result' : 'results'} · Page {state.page} of {pageCount}
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2">
            Rows
            <Select
              className="h-8 w-20"
              value={state.pageSize}
              onChange={(event) => props.onPageSizeChange(Number(event.target.value))}
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
          </label>
          <Button
            variant="outline"
            size="sm"
            disabled={state.page <= 1}
            onClick={() => props.onPageChange(state.page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={state.page >= pageCount}
            onClick={() => props.onPageChange(state.page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
