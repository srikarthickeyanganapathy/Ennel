import { type AdminLeave, type AdminLeaveListQuery, type LeaveState } from '@ennel/shared';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Info, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { errorMessage } from '@/shared/api-client/api-error';
import { ChoiceChip } from '@/shared/components/ChoiceChip';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { EmptyState, QueryBoundary } from '@/shared/components/QueryStates';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogFooter } from '@/shared/components/ui/dialog';
import { Checkbox, Input } from '@/shared/components/ui/form-controls';
import { PageHeader } from '@/shared/layout/PageHeader';
import { saveCsv, toCsv } from '@/shared/lib/csv';
import { formatBusinessDate } from '@/shared/lib/format';
import { approveLeave, listLeaves } from '../api/leaves-api';
import { CreateLeaveDialog } from '../components/CreateLeaveDialog';
import { type LeaveAction, LeaveActionDialog } from '../components/LeaveActionDialogs';
import { LeaveCalendarCard } from '../components/LeaveCalendarCard';
import { describeRange, MEAL_NAMES, STATE_DISPLAY } from '../components/leave-labels';

const PAGE_SIZE = 20;
type Filter = LeaveState | 'ALL';
/** Chips in the design's order; the first three show how many are in each. */
const CHIPS: { value: Filter; label: string; counted: boolean }[] = [
  { value: 'PENDING', label: 'Pending', counted: true },
  { value: 'UPCOMING', label: 'Upcoming', counted: true },
  { value: 'ON_LEAVE', label: 'On leave', counted: true },
  { value: 'ENDED', label: 'Past', counted: false },
  { value: 'REJECTED', label: 'Rejected', counted: false },
  { value: 'CANCELLED', label: 'Cancelled', counted: false },
  { value: 'ALL', label: 'All', counted: false },
];

/**
 * Admin §K, built from the Figma "Admin — Leave requests" frame: status chips, the request table
 * with approve and reject, bulk approval, the students-away calendar and the approval rule.
 */
export function LeavesPage() {
  const [chosen, setChosen] = useState<Filter | null>(null);
  const [text, setText] = useState({ q: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<LeaveAction | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const base = { q: text.q || undefined, from: text.from || undefined, to: text.to || undefined };
  const counts = useStateCounts(base);
  // Open on the approval queue when requests are waiting, as the design does.
  const filter: Filter = chosen ?? ((counts.PENDING ?? 0) > 0 ? 'PENDING' : 'ALL');
  const query: AdminLeaveListQuery = {
    ...base,
    state: filter === 'ALL' ? undefined : filter,
    page,
    pageSize: PAGE_SIZE,
  };
  const leaves = useQuery({
    queryKey: ['admin-leaves', 'list', query],
    queryFn: () => listLeaves(query),
  });
  const items = leaves.data?.items ?? [];
  const isQueue = filter === 'PENDING';
  const reset = () => {
    setPage(1);
    setSelected(new Set());
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave requests"
        breadcrumbs={[{ label: 'Leaves' }]}
        description={
          leaves.data
            ? `${leaves.data.pendingCount} waiting for review · meals during approved leave are paused, never No-shows`
            : undefined
        }
        actions={
          <PermissionGate permissions={['leaves:manage']}>
            <Button onClick={() => setIsCreating(true)}>Add leave for a student</Button>
          </PermissionGate>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Status" className="flex flex-wrap gap-2">
          {CHIPS.map((chip) => (
            <ChoiceChip
              key={chip.value}
              label={
                chip.counted && counts[chip.value] !== undefined
                  ? `${chip.label} · ${counts[chip.value]}`
                  : chip.label
              }
              isSelected={filter === chip.value}
              onClick={() => {
                setChosen(chip.value);
                reset();
              }}
            />
          ))}
        </div>
        {isQueue ? (
          <PermissionGate permissions={['leaves:approve']}>
            <Button
              variant="outline"
              className="min-h-12 border-[1.5px] border-primary text-primary lg:ml-auto"
              disabled={selected.size === 0}
              onClick={() => setIsBulkApproving(true)}
            >
              Approve selected{selected.size > 0 ? ` (${selected.size})` : ''}
            </Button>
          </PermissionGate>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="flex h-11 w-full items-center gap-2 rounded-md border border-border bg-background px-3 focus-within:outline-2 focus-within:outline-primary sm:w-72">
          <Search aria-hidden className="size-4 text-muted-foreground" />
          <input
            aria-label="Search student"
            placeholder="Name or reference no."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            value={text.q}
            onChange={(event) => (setText({ ...text, q: event.target.value }), reset())}
          />
        </label>
        <Input
          aria-label="From"
          type="date"
          className="w-40"
          value={text.from}
          onChange={(event) => (setText({ ...text, from: event.target.value }), reset())}
        />
        <Input
          aria-label="To"
          type="date"
          className="w-40"
          value={text.to}
          onChange={(event) => (setText({ ...text, to: event.target.value }), reset())}
        />
        <Button
          variant="ghost"
          className="text-primary sm:ml-auto"
          disabled={items.length === 0}
          onClick={() => exportPage(items)}
        >
          Export
        </Button>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <QueryBoundary
          isLoading={leaves.isLoading}
          error={leaves.error}
          onRetry={() => void leaves.refetch()}
        >
          {items.length === 0 ? (
            <EmptyState
              title={isQueue ? 'No requests are waiting' : 'No leaves match these filters'}
            />
          ) : (
            <LeaveTable
              items={items}
              total={leaves.data?.total ?? 0}
              page={page}
              onPageChange={setPage}
              isQueue={isQueue}
              selected={selected}
              onSelect={setSelected}
              onAction={setAction}
            />
          )}
        </QueryBoundary>
        <div className="flex flex-col gap-6">
          <LeaveCalendarCard />
          <ApprovalRuleCard requiresApproval={leaves.data?.requiresApproval ?? null} />
        </div>
      </div>

      <LeaveActionDialog
        key={action ? `${action.kind}-${action.leave.id}` : 'none'}
        action={action}
        onClose={() => setAction(null)}
      />
      {isCreating ? <CreateLeaveDialog onClose={() => setIsCreating(false)} /> : null}
      {isBulkApproving ? (
        <BulkApproveDialog
          leaves={items.filter((leave) => selected.has(leave.id))}
          onClose={() => setIsBulkApproving(false)}
          onDone={() => {
            setIsBulkApproving(false);
            setSelected(new Set());
          }}
        />
      ) : null}
    </div>
  );
}

function LeaveTable(props: {
  items: AdminLeave[];
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  isQueue: boolean;
  selected: Set<string>;
  onSelect: (ids: Set<string>) => void;
  onAction: (action: LeaveAction) => void;
}) {
  const { items, isQueue, selected } = props;
  const pageCount = Math.max(1, Math.ceil(props.total / PAGE_SIZE));
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    props.onSelect(next);
  };
  return (
    <div className="min-w-0 self-start overflow-hidden rounded-lg border border-border bg-background">
      {/* Positioned, so screen-reader-only labels stay inside the scrolling area. */}
      <div className="relative overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Leaves</caption>
          <thead className="whitespace-nowrap bg-neutral-surface text-left text-xs font-semibold text-muted-foreground">
            <tr>
              {isQueue ? (
                <th className="w-10 py-3 pl-5 pr-2">
                  <Checkbox
                    aria-label="Select all requests on this page"
                    checked={items.every((leave) => selected.has(leave.id))}
                    onChange={(event) =>
                      props.onSelect(
                        event.target.checked ? new Set(items.map((leave) => leave.id)) : new Set(),
                      )
                    }
                  />
                </th>
              ) : null}
              <th className={isQueue ? 'px-3 py-3' : 'py-3 pl-5 pr-3'}>Student</th>
              <th className="px-3 py-3">Dates</th>
              <th className="px-3 py-3">Meals</th>
              <th className="px-3 py-3">Skipped</th>
              <th className="px-3 py-3">Reason</th>
              {isQueue ? null : <th className="px-3 py-3">Status</th>}
              <th className="px-3 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((leave) => (
              <tr
                key={leave.id}
                className={
                  selected.has(leave.id)
                    ? 'border-t border-border bg-mint'
                    : 'border-t border-border'
                }
              >
                {isQueue ? (
                  <td className="py-3 pl-5 pr-2">
                    <Checkbox
                      aria-label={`Select ${leave.student.fullName}`}
                      checked={selected.has(leave.id)}
                      onChange={() => toggle(leave.id)}
                    />
                  </td>
                ) : null}
                <td className={isQueue ? 'px-3 py-3' : 'py-3 pl-5 pr-3'}>
                  <span className="block whitespace-nowrap text-[13px] font-semibold">
                    {leave.student.fullName}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {leave.student.referenceNumber}
                    {leave.student.blockName ? ` · ${leave.student.blockName}` : ''}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-[13px]">{dateText(leave)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-[13px]">
                  {MEAL_NAMES[leave.startMealType]} → {MEAL_NAMES[leave.endMealType]}
                </td>
                <td className="px-3 py-3 text-[13px] font-semibold">{leave.meals}</td>
                <td className="px-3 py-3 text-[13px] text-muted-foreground">
                  {leave.reason ?? '—'}
                  {leave.isCreatedByStaff ? (
                    <span className="block text-xs">Added by staff</span>
                  ) : null}
                </td>
                {isQueue ? null : (
                  <td className="px-3 py-3">
                    <StatusBadge {...STATE_DISPLAY[leave.state]} />
                  </td>
                )}
                <td className="px-3 py-3">
                  <RowActions leave={leave} onAction={props.onAction} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 ? (
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <Button
            size="sm"
            variant="ghost"
            disabled={props.page <= 1}
            onClick={() => props.onPageChange(props.page - 1)}
          >
            Previous
          </Button>
          <span>
            Page {props.page} of {pageCount}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={props.page >= pageCount}
            onClick={() => props.onPageChange(props.page + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** "22 – 31 May", or a single date when the leave is one day. */
function dateText(leave: AdminLeave): string {
  if (leave.startDate === leave.endDate) return formatBusinessDate(leave.startDate, 'd MMM');
  const sameMonth = leave.startDate.slice(0, 7) === leave.endDate.slice(0, 7);
  return `${formatBusinessDate(leave.startDate, sameMonth ? 'd' : 'd MMM')} – ${formatBusinessDate(leave.endDate, 'd MMM')}`;
}

function RowActions({
  leave,
  onAction,
}: {
  leave: AdminLeave;
  onAction: (action: LeaveAction) => void;
}) {
  const queryClient = useQueryClient();
  const approve = useMutation({
    mutationFn: () => approveLeave(leave.id, leave.version),
    onSuccess: (result) => {
      toast.success(`Approved. ${result.bookingsPaused} booked meals paused.`);
      void queryClient.invalidateQueries({ queryKey: ['admin-leaves'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'pending'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  if (leave.status === 'PENDING') {
    return (
      <PermissionGate permissions={['leaves:approve']}>
        <span className="flex gap-1.5">
          <Button
            size="icon"
            aria-label={`Approve leave for ${leave.student.fullName}`}
            className="size-9 bg-mint text-primary hover:bg-mint/70"
            disabled={approve.isPending}
            onClick={() => approve.mutate()}
          >
            <Check aria-hidden />
          </Button>
          <Button
            size="icon"
            aria-label={`Reject leave for ${leave.student.fullName}`}
            className="size-9 bg-danger-surface text-danger hover:bg-danger-surface/70"
            onClick={() => onAction({ kind: 'reject', leave })}
          >
            <X aria-hidden />
          </Button>
        </span>
      </PermissionGate>
    );
  }
  if (!leave.canChange || leave.status !== 'APPROVED') return null;
  return (
    <PermissionGate permissions={['leaves:manage']}>
      <span className="flex gap-1.5 whitespace-nowrap">
        <Button size="sm" variant="outline" onClick={() => onAction({ kind: 'end', leave })}>
          End early
        </Button>
        <Button size="sm" variant="outline" onClick={() => onAction({ kind: 'correct', leave })}>
          Correct
        </Button>
      </span>
    </PermissionGate>
  );
}

/** Approves each selected request through the normal, audited approve call. */
function BulkApproveDialog({
  leaves,
  onClose,
  onDone,
}: {
  leaves: AdminLeave[];
  onClose: () => void;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const run = useMutation({
    mutationFn: async () => {
      const failed: string[] = [];
      let paused = 0;
      for (const leave of leaves) {
        try {
          paused += (await approveLeave(leave.id, leave.version)).bookingsPaused;
        } catch (error) {
          failed.push(`${leave.student.fullName}: ${errorMessage(error)}`);
        }
      }
      return { failed, paused };
    },
    onSuccess: ({ failed, paused }) => {
      const approved = leaves.length - failed.length;
      if (approved > 0) toast.success(`${approved} approved. ${paused} booked meals paused.`);
      for (const message of failed) toast.error(message);
      void queryClient.invalidateQueries({ queryKey: ['admin-leaves'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'pending'] });
      onDone();
    },
  });
  return (
    <Dialog open onOpenChange={(isOpen) => (isOpen ? undefined : onClose())}>
      <DialogContent
        title={`Approve ${leaves.length} leave request(s)?`}
        description="Each student is notified and their booked meals in the leave are paused."
      >
        <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
          {leaves.map((leave) => (
            <li key={leave.id}>
              <strong>{leave.student.fullName}</strong> · {describeRange(leave)} · {leave.meals}{' '}
              meals
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Back
          </Button>
          <Button disabled={run.isPending} onClick={() => run.mutate()}>
            {run.isPending ? 'Approving…' : `Approve ${leaves.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Figma "Approval rule", tied to the real policy flag (`leaveRequiresApproval`, ADR-0007). The
 * design's "auto-approve short leave" is not a rule ENNEL has, so it is not shown.
 */
function ApprovalRuleCard({ requiresApproval }: { requiresApproval: boolean | null }) {
  return (
    <Card className="flex flex-col gap-2.5">
      <h2 className="text-base font-semibold">Approval rule</h2>
      <div>
        <p className="text-sm font-medium">
          {requiresApproval === null
            ? '…'
            : requiresApproval
              ? 'Leave needs approval'
              : 'Leave starts without approval'}
        </p>
        <p className="text-xs text-muted-foreground">
          {requiresApproval
            ? 'Requests wait here; booked meals stay booked until approved.'
            : 'Students’ leave is active at once; staff can still end or correct it.'}
        </p>
      </div>
      <div className="flex gap-2.5 rounded-md bg-warning-surface p-3 text-[13px]">
        <Info aria-hidden className="size-[18px] shrink-0 text-warning" />
        <p>
          This is a mess policy setting.{' '}
          <PermissionGate
            permissions={['policy:read']}
            fallback={<span>Ask a manager to change it.</span>}
          >
            <Link to="/policy" className="font-semibold text-primary hover:underline">
              Change it in Settings & rules
            </Link>
          </PermissionGate>
          ; every change is audited.
        </p>
      </div>
    </Card>
  );
}

/** Counts for the first three chips, under the current search and dates. */
function useStateCounts(
  base: Pick<AdminLeaveListQuery, 'q' | 'from' | 'to'>,
): Partial<Record<Filter, number>> {
  const states = CHIPS.filter((chip) => chip.counted).map((chip) => chip.value as LeaveState);
  const results = useQueries({
    queries: states.map((state) => {
      const query = { ...base, state, page: 1, pageSize: 1 };
      return { queryKey: ['admin-leaves', 'list', query], queryFn: () => listLeaves(query) };
    }),
  });
  return Object.fromEntries(
    states.flatMap((state, index) => {
      const total = results[index]?.data?.total;
      return total === undefined ? [] : [[state, total]];
    }),
  );
}

/** Admin UX standards: CSV of the leaves on screen. */
function exportPage(items: AdminLeave[]) {
  saveCsv(
    'leaves-page.csv',
    toCsv(
      ['Student', 'Reference number', 'Leave', 'Meals', 'Status', 'Reason'],
      items.map((leave) => [
        leave.student.fullName,
        leave.student.referenceNumber,
        describeRange(leave),
        leave.meals,
        STATE_DISPLAY[leave.state].label,
        leave.reason ?? '',
      ]),
    ),
  );
}
