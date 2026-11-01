import { type Announcement, ANNOUNCEMENT_STATUSES } from '@ennel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/shared/api-client/api-error';
import { DataTable, type DataTableColumnMeta } from '@/shared/components/DataTable';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/shared/components/ui/dialog';
import { Field, Input, Select } from '@/shared/components/ui/form-controls';
import { useTableState } from '@/shared/hooks/use-table-state';
import { PageHeader } from '@/shared/layout/PageHeader';
import { formatDateTime } from '@/shared/lib/format';
import {
  cancelAnnouncement,
  listAnnouncements,
  scheduleAnnouncement,
  sendAnnouncement,
} from '../api/announcements-api';
import {
  CATEGORY_NAMES,
  describeAudience,
  isEditable,
  istInputToIso,
  STATUS,
} from '../components/announcement-labels';
import { ComposeAnnouncementDialog } from '../components/ComposeAnnouncementDialog';

type Status = (typeof ANNOUNCEMENT_STATUSES)[number];
type Action =
  | { kind: 'compose'; announcement: Announcement | null }
  | { kind: 'send' | 'cancel' | 'schedule'; announcement: Announcement };

const meta = (value: (row: Announcement) => string): DataTableColumnMeta => ({
  exportValue: (row) => value(row as Announcement),
});
const deliveryText = (row: Announcement) =>
  row.status === 'SENT' || row.status === 'SENDING'
    ? `${row.deliveries.inApp} in-app · ${row.deliveries.pushSent} push sent · ${row.deliveries.pushFailed} push not delivered`
    : '—';

/** Admin §M: history, compose, schedule, send now and cancel. */
export function AnnouncementsPage() {
  const table = useTableState(20);
  const [status, setStatus] = useState('');
  const [action, setAction] = useState<Action | null>(null);
  const query = { ...table.state, status: (status || undefined) as Status | undefined };
  const list = useQuery({
    queryKey: ['admin-announcements', query],
    queryFn: () => listAnnouncements(query),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Announcements"
        breadcrumbs={[{ label: 'Announcements' }]}
        description="Messages to students in the app, with an optional push. Scheduled ones go out within a minute of their time."
        actions={
          <PermissionGate permissions={['announcements:manage']}>
            <Button onClick={() => setAction({ kind: 'compose', announcement: null })}>
              New announcement
            </Button>
          </PermissionGate>
        }
      />
      <DataTable
        caption="Announcements"
        columns={columns(setAction)}
        rows={list.data?.items ?? []}
        total={list.data?.total ?? 0}
        state={table.state}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        getRowId={(row) => row.id}
        isLoading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        emptyTitle="No announcements yet"
        exportFileName="announcements-page.csv"
        toolbar={
          <Select
            aria-label="Status"
            className="w-40"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              table.resetPage();
            }}
          >
            <option value="">All statuses</option>
            {ANNOUNCEMENT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS[value].label}
              </option>
            ))}
          </Select>
        }
      />
      {action?.kind === 'compose' ? (
        <ComposeAnnouncementDialog
          announcement={action.announcement}
          onClose={() => setAction(null)}
        />
      ) : null}
      {action && action.kind !== 'compose' ? (
        <ActionDialog
          key={`${action.kind}-${action.announcement.id}`}
          kind={action.kind}
          announcement={action.announcement}
          onClose={() => setAction(null)}
        />
      ) : null}
    </div>
  );
}

function columns(onAction: (action: Action) => void): ColumnDef<Announcement>[] {
  return [
    {
      id: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.title}</p>
          <p className="text-xs text-muted-foreground">{CATEGORY_NAMES[row.original.category]}</p>
        </div>
      ),
      meta: meta((row) => row.title),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge {...STATUS[row.original.status]} />,
      meta: meta((row) => STATUS[row.status].label),
    },
    {
      id: 'audience',
      header: 'Audience',
      cell: ({ row }) => describeAudience(row.original.audience),
      meta: meta((row) => describeAudience(row.audience)),
    },
    {
      id: 'when',
      header: 'When',
      cell: ({ row }) => whenText(row.original),
      meta: meta(whenText),
    },
    {
      id: 'deliveries',
      header: 'Delivery',
      cell: ({ row }) => deliveryText(row.original),
      meta: meta(deliveryText),
    },
    { id: 'by', header: 'By', cell: ({ row }) => row.original.createdByName },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        isEditable(row.original.status) ? (
          <PermissionGate permissions={['announcements:manage']}>
            <div className="flex flex-wrap gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAction({ kind: 'compose', announcement: row.original })}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAction({ kind: 'schedule', announcement: row.original })}
              >
                Schedule
              </Button>
              <Button
                size="sm"
                onClick={() => onAction({ kind: 'send', announcement: row.original })}
              >
                Send now
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onAction({ kind: 'cancel', announcement: row.original })}
              >
                Cancel
              </Button>
            </div>
          </PermissionGate>
        ) : null,
    },
  ];
}

function whenText(row: Announcement): string {
  if (row.sentAt) return `Sent ${formatDateTime(row.sentAt)}`;
  if (row.status === 'SCHEDULED' && row.scheduledFor)
    return `Scheduled for ${formatDateTime(row.scheduledFor)}`;
  return `Created ${formatDateTime(row.createdAt)}`;
}

const TEXT = {
  send: {
    title: 'Send this announcement now?',
    description:
      'Every student in the audience gets it in the app straight away. This cannot be undone.',
    confirm: 'Send now',
    done: 'Announcement sent.',
  },
  cancel: {
    title: 'Cancel this announcement?',
    description: 'It will not be sent. It stays in the history as Cancelled.',
    confirm: 'Cancel announcement',
    done: 'Announcement cancelled.',
  },
  schedule: {
    title: 'Schedule this announcement',
    description: 'Times are India Standard Time (IST).',
    confirm: 'Schedule',
    done: 'Announcement scheduled.',
  },
} as const;

/** Spec-style confirmation for irreversible sends (Admin UX standards). */
function ActionDialog({
  kind,
  announcement,
  onClose,
}: {
  kind: 'send' | 'cancel' | 'schedule';
  announcement: Announcement;
  onClose: () => void;
}) {
  const id = useId();
  const queryClient = useQueryClient();
  const [when, setWhen] = useState('');
  const text = TEXT[kind];
  const mutation = useMutation({
    mutationFn: () => {
      if (kind === 'send') return sendAnnouncement(announcement.id, announcement.version);
      if (kind === 'cancel') return cancelAnnouncement(announcement.id, announcement.version);
      return scheduleAnnouncement(announcement.id, istInputToIso(when), announcement.version);
    },
    onSuccess: () => {
      toast.success(text.done);
      void queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(isOpen) => (isOpen ? undefined : onClose())}>
      <DialogContent
        title={text.title}
        description={`“${announcement.title}”. ${text.description}`}
      >
        {kind === 'schedule' ? (
          <Field label="Send at (IST)" htmlFor={`${id}-when`}>
            <Input
              id={`${id}-when`}
              type="datetime-local"
              value={when}
              onChange={(event) => setWhen(event.target.value)}
            />
          </Field>
        ) : null}
        {mutation.error ? (
          <p className="mt-2 text-sm text-destructive">{errorMessage(mutation.error)}</p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Back
          </Button>
          <Button
            variant={kind === 'cancel' ? 'destructive' : 'default'}
            disabled={mutation.isPending || (kind === 'schedule' && !when)}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Working…' : text.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
