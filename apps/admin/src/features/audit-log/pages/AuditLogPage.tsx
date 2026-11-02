import { type AuditLogItem } from '@ennel/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/shared/api-client/api-error';
import { ChoiceChip } from '@/shared/components/ChoiceChip';
import { DataTable, type DataTableColumnMeta } from '@/shared/components/DataTable';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { Field, Input } from '@/shared/components/ui/form-controls';
import { useTableState } from '@/shared/hooks/use-table-state';
import { PageHeader } from '@/shared/layout/PageHeader';
import { formatDateTime } from '@/shared/lib/format';
import { formatRoles } from '@/features/staff/constants/role-labels';
import { exportAuditLogs, listAuditLogs } from '../api/audit-log-api';

const meta = (value: (row: AuditLogItem) => string): DataTableColumnMeta => ({
  exportValue: (row) => value(row as AuditLogItem),
});

const COLUMNS: ColumnDef<AuditLogItem, unknown>[] = [
  {
    id: 'createdAt',
    header: 'When',
    cell: ({ row }) => (
      <span className="whitespace-nowrap">{formatDateTime(row.original.createdAt)}</span>
    ),
    meta: meta((row) => row.createdAt),
  },
  {
    id: 'actor',
    header: 'Who',
    cell: ({ row }) => (
      <span>
        <span className="block font-semibold">
          {row.original.actorName ?? row.original.actorType}
        </span>
        <span className="block text-xs text-muted-foreground">
          {formatRoles(row.original.actorRoles)}
        </span>
      </span>
    ),
    meta: meta((row) => row.actorName ?? row.actorType),
  },
  {
    id: 'action',
    header: 'Action',
    cell: ({ row }) => (
      <span className="flex flex-wrap items-center gap-1">
        <code className="text-xs">{row.original.action}</code>
        {row.original.isOverride ? <StatusBadge label="Override" tone="warning" /> : null}
      </span>
    ),
    meta: meta((row) => row.action),
  },
  {
    id: 'entity',
    header: 'Record',
    cell: ({ row }) => (
      <span className="text-xs">
        {row.original.entityType}
        <span className="block font-mono text-muted-foreground">{row.original.entityId}</span>
      </span>
    ),
    meta: meta((row) => `${row.entityType}:${row.entityId}`),
  },
  {
    id: 'reason',
    header: 'Reason',
    cell: ({ row }) => row.original.reason ?? '—',
    meta: meta((row) => row.reason ?? ''),
  },
  {
    id: 'change',
    header: 'Change',
    cell: ({ row }) => (
      <details className="max-w-md text-xs">
        <summary className="cursor-pointer font-semibold text-primary">View</summary>
        <pre className="mt-1 whitespace-pre-wrap break-all rounded bg-surface p-2">
          {JSON.stringify({ before: row.original.before, after: row.original.after }, null, 2)}
        </pre>
      </details>
    ),
  },
];

/** Admin §P: read-only audit viewer with filters and export. */
export function AuditLogPage() {
  const table = useTableState(50);
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    entityId: '',
    from: '',
    to: '',
    isOverride: false,
  });
  const query = {
    ...table.state,
    action: filters.action || undefined,
    entityType: filters.entityType || undefined,
    entityId: filters.entityId || undefined,
    from: filters.from ? new Date(`${filters.from}T00:00:00+05:30`).toISOString() : undefined,
    to: filters.to ? new Date(`${filters.to}T23:59:59.999+05:30`).toISOString() : undefined,
    isOverride: filters.isOverride ? ('true' as const) : undefined,
  };
  const logs = useQuery({ queryKey: ['audit-logs', query], queryFn: () => listAuditLogs(query) });
  const download = useMutation({
    mutationFn: () => exportAuditLogs(query),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const update = (key: keyof typeof filters, value: string | boolean) => {
    setFilters((current) => ({ ...current, [key]: value }));
    table.resetPage();
  };

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Every staff change, who made it and why. Entries cannot be edited or deleted."
        breadcrumbs={[{ label: 'Audit log' }]}
        actions={
          <PermissionGate permissions={['audit-log:export']}>
            <Button
              variant="outline"
              onClick={() => download.mutate()}
              disabled={download.isPending}
            >
              {download.isPending ? 'Exporting…' : 'Export all matching (CSV)'}
            </Button>
          </PermissionGate>
        }
      />
      <DataTable
        caption="Audit log entries"
        columns={COLUMNS}
        rows={logs.data?.items ?? []}
        total={logs.data?.total ?? 0}
        state={table.state}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        getRowId={(row) => row.id}
        isLoading={logs.isLoading}
        error={logs.error}
        onRetry={() => void logs.refetch()}
        emptyTitle="No audit entries match these filters"
        exportFileName="audit-log-page.csv"
        toolbar={
          <>
            <Input
              aria-label="Action starts with"
              placeholder="Action, e.g. staff."
              className="w-48"
              value={filters.action}
              onChange={(event) => update('action', event.target.value)}
            />
            <Input
              aria-label="Record type"
              placeholder="Record type"
              className="w-36"
              value={filters.entityType}
              onChange={(event) => update('entityType', event.target.value)}
            />
            <Input
              aria-label="Record ID"
              placeholder="Record ID"
              className="w-72"
              value={filters.entityId}
              onChange={(event) => update('entityId', event.target.value)}
            />
            <Field label="From" htmlFor="audit-from">
              <Input
                id="audit-from"
                type="date"
                className="w-40"
                value={filters.from}
                onChange={(event) => update('from', event.target.value)}
              />
            </Field>
            <Field label="To" htmlFor="audit-to">
              <Input
                id="audit-to"
                type="date"
                className="w-40"
                value={filters.to}
                onChange={(event) => update('to', event.target.value)}
              />
            </Field>
            <ChoiceChip
              role="checkbox"
              label="Overrides only"
              isSelected={filters.isOverride}
              onClick={() => update('isOverride', !filters.isOverride)}
            />
          </>
        }
      />
    </div>
  );
}
