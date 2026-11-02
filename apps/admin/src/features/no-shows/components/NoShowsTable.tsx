import {
  type AdminNoShowEvent,
  MEAL_TYPE_ORDER,
  type MealType,
  type NoShowStatus,
} from '@ennel/shared';
import { useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { DataTable, type DataTableColumnMeta } from '@/shared/components/DataTable';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { StatusBadge, type StatusTone } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { Input, Select } from '@/shared/components/ui/form-controls';
import { useTableState } from '@/shared/hooks/use-table-state';
import { addDays, formatBusinessDate, todayBusinessDate } from '@/shared/lib/format';
import { listNoShows } from '../api/no-shows-api';
import { type NoShowAction } from './NoShowActionDialog';

const MEAL_NAMES: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
};
const STATUS: Record<NoShowStatus, { label: string; tone: StatusTone }> = {
  COUNTED: { label: 'Counted', tone: 'danger' },
  HELD_FOR_REVIEW: { label: 'Held for review', tone: 'warning' },
  EXCLUDED: { label: 'Removed', tone: 'neutral' },
};
const meta = (value: (row: AdminNoShowEvent) => string): DataTableColumnMeta => ({
  exportValue: (row) => value(row as AdminNoShowEvent),
});
const describe = (event: AdminNoShowEvent) =>
  `${MEAL_NAMES[event.mealType]}, ${formatBusinessDate(event.date, 'EEE d MMM')}`;

/** Admin §J: every No-show, opening on the rolling window (BR-NS-3), with the manual actions. */
export function NoShowsTable({
  windowDays,
  onAction,
}: {
  windowDays: number;
  onAction: (action: NoShowAction) => void;
}) {
  const table = useTableState(20);
  const [filters, setFilters] = useState(() => ({
    status: '',
    mealType: '',
    from: addDays(todayBusinessDate(), -(windowDays - 1)),
    to: '',
    q: '',
  }));
  const query = {
    ...table.state,
    status: (filters.status || undefined) as NoShowStatus | undefined,
    mealType: (filters.mealType || undefined) as MealType | undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    q: filters.q || undefined,
  };
  const list = useQuery({ queryKey: ['admin-no-shows', query], queryFn: () => listNoShows(query) });
  const update = (key: keyof typeof filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    table.resetPage();
  };

  return (
    <DataTable
      caption="No-shows"
      columns={columns(onAction)}
      rows={list.data?.items ?? []}
      total={list.data?.total ?? 0}
      state={table.state}
      onPageChange={table.setPage}
      onPageSizeChange={table.setPageSize}
      getRowId={(row) => row.id}
      isLoading={list.isLoading}
      error={list.error}
      onRetry={() => void list.refetch()}
      emptyTitle="No No-shows match these filters"
      exportFileName="no-shows-page.csv"
      toolbar={
        <>
          <Input
            aria-label="Search student"
            placeholder="Name or reference number"
            className="w-56"
            value={filters.q}
            onChange={(event) => update('q', event.target.value)}
          />
          <Select
            aria-label="Status"
            className="w-40"
            value={filters.status}
            onChange={(event) => update('status', event.target.value)}
          >
            <option value="">All statuses</option>
            {(Object.keys(STATUS) as NoShowStatus[]).map((status) => (
              <option key={status} value={status}>
                {STATUS[status].label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Meal"
            className="w-36"
            value={filters.mealType}
            onChange={(event) => update('mealType', event.target.value)}
          >
            <option value="">All meals</option>
            {MEAL_TYPE_ORDER.map((meal) => (
              <option key={meal} value={meal}>
                {MEAL_NAMES[meal]}
              </option>
            ))}
          </Select>
          <Input
            aria-label="From"
            type="date"
            className="w-40"
            value={filters.from}
            onChange={(event) => update('from', event.target.value)}
          />
          <Input
            aria-label="To"
            type="date"
            className="w-40"
            value={filters.to}
            onChange={(event) => update('to', event.target.value)}
          />
        </>
      }
    />
  );
}

function columns(onAction: (action: NoShowAction) => void): ColumnDef<AdminNoShowEvent, unknown>[] {
  return [
    {
      id: 'student',
      header: 'Student',
      cell: ({ row }) => (
        <span>
          {row.original.student.fullName}
          <span className="block text-xs text-muted-foreground">
            {row.original.student.referenceNumber}
            {row.original.student.blockName ? ` · ${row.original.student.blockName}` : ''}
          </span>
        </span>
      ),
      meta: meta((row) => `${row.student.fullName} (${row.student.referenceNumber})`),
    },
    {
      id: 'meal',
      header: 'Meal',
      cell: ({ row }) => describe(row.original),
      meta: meta((row) => describe(row)),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <span className="flex flex-wrap gap-1">
          <StatusBadge {...STATUS[row.original.status]} />
          {row.original.appeal ? (
            <StatusBadge label={`Report ${row.original.appeal.status.toLowerCase()}`} tone="info" />
          ) : null}
        </span>
      ),
      meta: meta((row) => STATUS[row.status].label),
    },
    {
      id: 'count',
      header: 'Counted (30 days)',
      cell: ({ row }) => (
        <span>
          {row.original.currentCount}
          {row.original.isAutoDisabled ? (
            <span className="block text-xs text-danger">Default Booking off</span>
          ) : null}
        </span>
      ),
      meta: meta((row) => String(row.currentCount)),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <PermissionGate permissions={['no-shows:reset']}>
          <span className="flex gap-2">
            {row.original.currentCount > 0 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAction({ kind: 'reset', event: row.original })}
              >
                Reset count
              </Button>
            ) : null}
            {row.original.isAutoDisabled ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAction({ kind: 'reEnable', event: row.original })}
              >
                Re-enable
              </Button>
            ) : null}
          </span>
        </PermissionGate>
      ),
    },
  ];
}
