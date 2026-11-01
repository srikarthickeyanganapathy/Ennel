import { type AdminComplaintDetail, type ComplaintStatus } from '@ennel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, EyeOff, Plus, UserRound } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/shared/api-client/api-error';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { ErrorState, LoadingState } from '@/shared/components/QueryStates';
import { Button } from '@/shared/components/ui/button';
import { Select, Textarea } from '@/shared/components/ui/form-controls';
import { formatBusinessDate, formatDateTime } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import {
  addComplaintNote,
  assignComplaint,
  changeComplaintStatus,
  closeWithReply,
  getComplaint,
  listAssignees,
} from '../api/complaints-api';
import { CATEGORY_NAMES, MEAL_NAMES, STATUS, TYPE_NAMES } from './complaint-labels';

const REPLY_MAX = 2000;
const FLOW: ComplaintStatus[] = ['NEW', 'IN_REVIEW', 'RESOLVED', 'REJECTED'];

/** Figma "Admin — Complaints" detail pane (Admin §L): identity, message, photos, notes, reply. */
/** `isInDialog`: the dialog already shows the title, so the pane leaves out its own heading. */
export function ComplaintDetailPanel({
  id,
  isInDialog = false,
}: {
  id: string;
  isInDialog?: boolean;
}) {
  const detail = useQuery({
    queryKey: ['admin-complaints', 'detail', id],
    queryFn: () => getComplaint(id),
  });
  if (detail.isLoading) return <LoadingState label="Loading complaint…" />;
  if (detail.error)
    return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />;
  // Keyed by version so the reply box and buttons reset after every change.
  return detail.data ? (
    <Detail key={detail.data.version} complaint={detail.data} isInDialog={isInDialog} />
  ) : null;
}

export function complaintTitle(
  complaint: Pick<AdminComplaintDetail, 'category' | 'type' | 'mealType' | 'mealDate'>,
) {
  const meal =
    complaint.mealType && complaint.mealDate
      ? `${MEAL_NAMES[complaint.mealType]}, ${formatBusinessDate(complaint.mealDate, 'EEE d MMM')}`
      : TYPE_NAMES[complaint.type];
  return `${CATEGORY_NAMES[complaint.category]} · ${meal}`;
}

function useRefresh() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['admin-complaints'] });
}

function Detail({
  complaint,
  isInDialog,
}: {
  complaint: AdminComplaintDetail;
  isInDialog: boolean;
}) {
  return (
    <div className="flex flex-col gap-3.5">
      <Header complaint={complaint} isInDialog={isInDialog} />
      <Identity complaint={complaint} />
      <PermissionGate permissions={['complaints:assign']}>
        <AssignRow complaint={complaint} />
      </PermissionGate>
      <p className="whitespace-pre-wrap rounded-md bg-surface px-3.5 py-3 text-sm">
        {complaint.description}
      </p>
      {complaint.photos.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {complaint.photos.map((photo, index) => (
            <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer" className="block">
              <img
                src={photo.url}
                alt={`Photo ${index + 1} of ${complaint.photos.length}`}
                className="h-[90px] w-[120px] rounded-md bg-neutral-surface object-cover"
              />
            </a>
          ))}
        </div>
      ) : null}
      <Notes complaint={complaint} />
      <ReplySection complaint={complaint} />
      <details className="text-sm">
        <summary className="cursor-pointer text-[13px] font-medium text-muted-foreground">
          Status history
        </summary>
        <ol className="mt-2 space-y-1 text-muted-foreground">
          {complaint.history.map((entry) => (
            <li key={`${entry.toStatus}-${entry.createdAt}`}>
              {formatDateTime(entry.createdAt)}: {STATUS[entry.toStatus].label}
              {entry.actorName ? ` by ${entry.actorName}` : ' (submitted)'}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

/** The status chips double as the "Start review" control; closing goes through the reply buttons. */
function Header({
  complaint,
  isInDialog,
}: {
  complaint: AdminComplaintDetail;
  isInDialog: boolean;
}) {
  const refresh = useRefresh();
  const review = useMutation({
    mutationFn: () =>
      changeComplaintStatus(complaint.id, { status: 'IN_REVIEW', version: complaint.version }),
    onSuccess: () => {
      toast.success(
        complaint.privacyMode === 'PRIVATE_IDENTIFIED'
          ? 'Marked In review. The student was notified.'
          : 'Marked In review.',
      );
      refresh();
    },
  });
  const isClosed = complaint.status === 'RESOLVED' || complaint.status === 'REJECTED';
  const chips = FLOW.filter(
    (status) => status !== (complaint.status === 'REJECTED' ? 'RESOLVED' : 'REJECTED'),
  );
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
      <div className="min-w-0 flex-1">
        {isInDialog ? null : <h2 className="text-lg font-semibold">{complaintTitle(complaint)}</h2>}
        <p className="text-xs text-muted-foreground">
          {complaint.referenceCode} · received {formatDateTime(complaint.createdAt)}
        </p>
      </div>
      <div role="group" aria-label="Status" className="flex flex-wrap gap-1.5">
        {chips.map((status) => {
          const isCurrent = status === complaint.status;
          const canStart = status === 'IN_REVIEW' && complaint.status === 'NEW';
          return (
            <PermissionGate
              key={status}
              permissions={['complaints:resolve']}
              fallback={<StatusChoice status={status} isCurrent={isCurrent} />}
            >
              <StatusChoice
                status={status}
                isCurrent={isCurrent}
                onClick={canStart && !review.isPending ? () => review.mutate() : undefined}
                hint={
                  !isCurrent && !canStart && !isClosed && status !== 'NEW'
                    ? 'Use the reply buttons to close'
                    : undefined
                }
              />
            </PermissionGate>
          );
        })}
      </div>
      {review.error ? (
        <p className="text-sm text-destructive">{errorMessage(review.error)}</p>
      ) : null}
    </div>
  );
}

function StatusChoice({
  status,
  isCurrent,
  onClick,
  hint,
}: {
  status: ComplaintStatus;
  isCurrent: boolean;
  onClick?: () => void;
  hint?: string;
}) {
  const Icon = isCurrent ? Check : Plus;
  return (
    <button
      type="button"
      aria-pressed={isCurrent}
      disabled={!onClick}
      title={hint}
      onClick={onClick}
      className={cn(
        'flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] pl-3 pr-3.5 text-sm',
        isCurrent
          ? 'border-primary bg-mint font-semibold text-primary'
          : 'border-border bg-background text-foreground',
        onClick ? 'hover:border-primary' : 'cursor-default',
        !isCurrent && !onClick && 'opacity-60',
      )}
    >
      <Icon aria-hidden className="size-4" />
      {STATUS[status].label}
    </button>
  );
}

/** ADR-0008/0028: anonymous reports never carry identity; there is nothing to reveal. */
function Identity({ complaint }: { complaint: AdminComplaintDetail }) {
  const submitter = complaint.submitter;
  return (
    <div className="flex items-center gap-2 rounded-md bg-neutral-surface px-3 py-2.5 text-[13px] font-medium">
      {submitter ? (
        <>
          <UserRound aria-hidden className="size-4 text-muted-foreground" />
          <span>
            From {submitter.fullName} · {submitter.referenceNumber}
            {submitter.blockName ? ` · ${submitter.blockName}` : ''}
          </span>
        </>
      ) : (
        <>
          <EyeOff aria-hidden className="size-4 text-muted-foreground" />
          <span>Student identity hidden</span>
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {complaint.privacyMode === 'ANONYMOUS' ? 'Sent anonymously' : 'Anonymous mode is on'}
          </span>
        </>
      )}
    </div>
  );
}

function AssignRow({ complaint }: { complaint: AdminComplaintDetail }) {
  const id = useId();
  const refresh = useRefresh();
  const assignees = useQuery({ queryKey: ['complaint-assignees'], queryFn: listAssignees });
  const assign = useMutation({
    mutationFn: (staffId: string | null) =>
      assignComplaint(complaint.id, staffId, complaint.version),
    onSuccess: (updated) => {
      toast.success(
        updated.assignedTo ? `Assigned to ${updated.assignedTo.fullName}.` : 'Unassigned.',
      );
      refresh();
    },
  });
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px]">
      <label htmlFor={id} className="font-medium text-muted-foreground">
        Assigned to
      </label>
      <Select
        id={id}
        className="h-9 w-auto min-w-44"
        value={complaint.assignedTo?.id ?? ''}
        disabled={assign.isPending || assignees.isLoading}
        onChange={(event) => assign.mutate(event.target.value || null)}
      >
        <option value="">Nobody</option>
        {(assignees.data ?? []).map((staff) => (
          <option key={staff.id} value={staff.id}>
            {staff.fullName}
          </option>
        ))}
      </Select>
      {assign.error ? <span className="text-destructive">{errorMessage(assign.error)}</span> : null}
    </div>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

/** Internal notes are never visible to students (BR-CMP-1). */
function Notes({ complaint }: { complaint: AdminComplaintDetail }) {
  const id = useId();
  const refresh = useRefresh();
  const [isWriting, setIsWriting] = useState(false);
  const [body, setBody] = useState('');
  const add = useMutation({
    mutationFn: () => addComplaintNote(complaint.id, body.trim()),
    onSuccess: () => {
      setBody('');
      setIsWriting(false);
      toast.success('Note added.');
      refresh();
    },
  });
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-[13px] font-semibold text-muted-foreground">
        Internal notes · not visible to student
      </h3>
      {complaint.notes.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No notes yet.</p>
      ) : null}
      {complaint.notes.map((note) => (
        <div key={note.id} className="flex gap-2.5">
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-mint text-[11px] font-bold text-primary"
          >
            {initials(note.authorName)}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold">
              {note.authorName} · {formatDateTime(note.createdAt)}
            </p>
            <p className="whitespace-pre-wrap text-[13px]">{note.body}</p>
          </div>
        </div>
      ))}
      <PermissionGate permissions={['complaints:note']}>
        {isWriting ? (
          <div className="flex flex-col gap-2">
            <label htmlFor={id} className="sr-only">
              New internal note
            </label>
            <Textarea
              id={id}
              autoFocus
              value={body}
              maxLength={2000}
              placeholder="Only staff see this note."
              onChange={(event) => setBody(event.target.value)}
            />
            {add.error ? (
              <p className="text-sm text-destructive">{errorMessage(add.error)}</p>
            ) : null}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => add.mutate()}
                disabled={add.isPending || body.trim().length === 0}
              >
                {add.isPending ? 'Saving…' : 'Save note'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsWriting(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            className="self-start text-primary"
            onClick={() => setIsWriting(true)}
          >
            Add internal note
          </Button>
        )}
      </PermissionGate>
    </section>
  );
}

/** BR-CMP-4: closing always carries a reply the student sees. */
function ReplySection({ complaint }: { complaint: AdminComplaintDetail }) {
  const id = useId();
  const refresh = useRefresh();
  const [reply, setReply] = useState('');
  const close = useMutation({
    mutationFn: (status: 'RESOLVED' | 'REJECTED') =>
      closeWithReply(complaint, status, reply.trim()),
    onSuccess: (updated) => {
      toast.success(
        complaint.privacyMode === 'PRIVATE_IDENTIFIED'
          ? `Marked ${STATUS[updated.status].label}. The student was notified.`
          : `Marked ${STATUS[updated.status].label}.`,
      );
      refresh();
    },
  });
  if (complaint.status === 'RESOLVED' || complaint.status === 'REJECTED') {
    return complaint.response ? (
      <section className="rounded-md border border-primary/40 p-3 text-sm">
        <p className="text-[13px] font-medium text-muted-foreground">Reply sent to the student</p>
        <p className="mt-1 whitespace-pre-wrap">{complaint.response}</p>
      </section>
    ) : null;
  }
  const hasReply = reply.trim().length > 0;
  return (
    <PermissionGate permissions={['complaints:resolve']}>
      <section className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-[13px] font-medium text-muted-foreground">
          Reply to student
        </label>
        <div className="rounded-md border-2 border-border bg-background p-3 focus-within:border-primary">
          <textarea
            id={id}
            rows={3}
            value={reply}
            maxLength={REPLY_MAX}
            onChange={(event) => setReply(event.target.value)}
            placeholder="What happened and what the mess office did about it."
            className="w-full resize-y bg-transparent text-sm outline-none"
          />
          <p className="text-[11px] text-muted-foreground">
            {reply.length} / {REPLY_MAX}
          </p>
        </div>
        {close.error ? (
          <p className="text-sm text-destructive">{errorMessage(close.error)}</p>
        ) : null}
        <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            className="min-h-12 border-[1.5px] border-primary text-primary"
            disabled={!hasReply || close.isPending}
            onClick={() => close.mutate('REJECTED')}
          >
            Reject with reply
          </Button>
          <Button
            className="min-h-12"
            disabled={!hasReply || close.isPending}
            onClick={() => close.mutate('RESOLVED')}
          >
            {close.isPending ? 'Saving…' : 'Reply & resolve'}
          </Button>
        </div>
      </section>
    </PermissionGate>
  );
}
