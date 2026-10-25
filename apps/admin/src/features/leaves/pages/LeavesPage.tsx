import { type AdminLeave, LEAVE_STATES, type LeaveState } from '@ennel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/shared/api-client/api-error';
import { DataTable, type DataTableColumnMeta } from '@/shared/components/DataTable';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardHeader } from '@/shared/components/ui/card';
import { Input, Select } from '@/shared/components/ui/form-controls';
import { useTableState } from '@/shared/hooks/use-table-state';
import { PageHeader } from '@/shared/layout/PageHeader';
import { formatDateTime } from '@/shared/lib/format';
import { approveLeave, listLeaves } from '../api/leaves-api';
import { CreateLeaveDialog } from '../components/CreateLeaveDialog';
import { type LeaveAction, LeaveActionDialog } from '../components/LeaveActionDialogs';
import { describeRange, STATE_DISPLAY } from '../components/leave-labels';

const meta = (value: (row: AdminLeave) => string): DataTableColumnMeta => ({
  exportValue: (row) => value(row as AdminLeave),
});

/** Admin §K: approval queue, all leaves with filters, and changes on a student's behalf. */
export function LeavesPage() {
  const table = useTableState(20);
  const [filters, setFilters] = useState({ state: '', from: '', to: '', q: '' });
  const [action, setAction] = useState<LeaveAction | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const query = {
    ...table.state,
    state: (filters.state || undefined) as LeaveState | undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    q: filters.q || undefined,
  };
  const leaves = useQuery({ queryKey: ['admin-leaves', query], queryFn: () => listLeaves(query) });
  const update = (key: keyof typeof filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    table.resetPage();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Leaves"
        breadcrumbs={[{ label: 'Leaves' }]}
        description="Meals during approved leave are paused and never counted as No-shows."
        actions={
          <PermissionGate permissions={['leaves:manage']}>
            <Button onClick={() => setIsCreating(true)}>Add leave for a student</Button>
          </PermissionGate>
        }
      />
      <ApprovalQueue onReject={(leave) => setAction({ kind: 'reject', leave })} />
      <DataTable
        caption="Leaves"
        columns={columns(setAction)}
        rows={leaves.data?.items ?? []}
        total={leaves.data?.total ?? 0}
        state={table.state}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        getRowId={(row) => row.id}
        isLoading={leaves.isLoading}
        error={leaves.error}
        onRetry={() => void leaves.refetch()}
        emptyTitle="No leaves match these filters"
        exportFileName="leaves-page.csv"
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
              className="w-44"
              value={filters.state}
              onChange={(event) => update('state', event.target.value)}
            >
              <option value="">All statuses</option>
              {LEAVE_STATES.map((state) => (
                <option key={state} value={state}>
                  {STATE_DISPLAY[state].label}
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
      <LeaveActionDialog
        key={action ? `${action.kind}-${action.leave.id}` : 'none'}
        action={action}
        onClose={() => setAction(null)}
      />
      {isCreating ? <CreateLeaveDialog onClose={() => setIsCreating(false)} /> : null}
    </div>
  );
}

/** Shown while requests wait (BR-LEAVE-3); oldest start first. */
function ApprovalQueue({ onReject }: { onReject: (leave: AdminLeave) => void }) {
  const queryClient = useQueryClient();
  const pending = useQuery({
    queryKey: ['admin-leaves', 'pending'],
    queryFn: () => listLeaves({ status: 'PENDING', page: 1, pageSize: 50 }),
  });
  const approve = useMutation({
    mutationFn: (leave: AdminLeave) => approveLeave(leave.id, leave.version),
    onSuccess: (result) => {
      toast.success(`Approved. ${result.bookingsPaused} booked meals paused.`);
      void queryClient.invalidateQueries({ queryKey: ['admin-leaves'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const items = pending.data?.items ?? [];
  if (!pending.data || (items.length === 0 && !pending.data.requiresApproval)) return null;
  return (
    <Card>
      <CardHeader
        title={`Approval queue (${pending.data.pendingCount})`}
        description="Booked meals stay booked until a request is approved."
      />
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No requests are waiting.</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((leave) => (
            <li key={leave.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="text-sm">
                <strong>{leave.student.fullName}</strong>{' '}
                <span className="text-muted-foreground">{leave.student.referenceNumber}</span>
                <span className="block">
                  {describeRange(leave)} · {leave.meals} meals
                  {leave.reason ? ` · “${leave.reason}”` : ''}
                </span>
              </span>
              <PermissionGate permissions={['leaves:approve']}>
                <span className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={approve.isPending}
                    onClick={() => approve.mutate(leave)}
                  >
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onReject(leave)}>
                    Reject
                  </Button>
                </span>
              </PermissionGate>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function columns(setAction: (action: LeaveAction) => void): ColumnDef<AdminLeave, unknown>[] {
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
      id: 'range',
      header: 'Leave',
      cell: ({ row }) => (
        <span>
          {describeRange(row.original)}
          <span className="block text-xs text-muted-foreground">
            {row.original.days} days, {row.original.meals} meals
            {row.original.isCreatedByStaff ? ' · added by staff' : ''}
          </span>
        </span>
      ),
      meta: meta((row) => describeRange(row)),
    },
    {
      id: 'state',
      header: 'Status',
      cell: ({ row }) => <StatusBadge {...STATE_DISPLAY[row.original.state]} />,
      meta: meta((row) => STATE_DISPLAY[row.state].label),
    },
    {
      id: 'decided',
      header: 'Decided',
      cell: ({ row }) =>
        row.original.decidedAt
          ? `${formatDateTime(row.original.decidedAt)}${row.original.decidedByName ? ` by ${row.original.decidedByName}` : ''}`
          : '—',
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) =>
        row.original.canChange && row.original.status === 'APPROVED' ? (
          <PermissionGate permissions={['leaves:manage']}>
            <span className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAction({ kind: 'end', leave: row.original })}
              >
                End early
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAction({ kind: 'correct', leave: row.original })}
              >
                Correct
              </Button>
            </span>
          </PermissionGate>
        ) : null,
    },
  ];
}
