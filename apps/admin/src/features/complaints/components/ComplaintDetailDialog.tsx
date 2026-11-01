import {
  type AdminComplaintDetail,
  changeComplaintStatusRequestSchema,
  type ComplaintStatus,
} from '@ennel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/shared/api-client/api-error';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { ErrorState, LoadingState } from '@/shared/components/QueryStates';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent } from '@/shared/components/ui/dialog';
import { Field, Select, Textarea } from '@/shared/components/ui/form-controls';
import { formatBusinessDate, formatDateTime } from '@/shared/lib/format';
import {
  addComplaintNote,
  assignComplaint,
  changeComplaintStatus,
  getComplaint,
  listAssignees,
} from '../api/complaints-api';
import { CATEGORY_NAMES, MEAL_NAMES, NEXT_STATUSES, STATUS, TYPE_NAMES } from './complaint-labels';

/** Admin §L detail: photos by signed link, workflow, assignment and internal notes. */
export function ComplaintDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useQuery({
    queryKey: ['admin-complaints', 'detail', id],
    queryFn: () => getComplaint(id),
  });
  return (
    <Dialog open onOpenChange={(isOpen) => (isOpen ? undefined : onClose())}>
      <DialogContent
        title={detail.data ? `${detail.data.referenceCode}` : 'Complaint'}
        description={detail.data ? describe(detail.data) : undefined}
        className="max-w-2xl"
      >
        {detail.isLoading ? <LoadingState label="Loading complaint…" /> : null}
        {detail.error ? (
          <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
        ) : null}
        {detail.data ? <DetailBody complaint={detail.data} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function describe(complaint: AdminComplaintDetail): string {
  const meal =
    complaint.mealType && complaint.mealDate
      ? ` · ${MEAL_NAMES[complaint.mealType]}, ${formatBusinessDate(complaint.mealDate)}`
      : '';
  return `${TYPE_NAMES[complaint.type]} · ${CATEGORY_NAMES[complaint.category]}${meal} · sent ${formatDateTime(complaint.createdAt)}`;
}

function DetailBody({ complaint }: { complaint: AdminComplaintDetail }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge {...STATUS[complaint.status]} />
        <span className="text-sm text-muted-foreground">
          From: <Submitter complaint={complaint} />
        </span>
      </div>
      <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{complaint.description}</p>
      {complaint.photos.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {complaint.photos.map((photo, index) => (
            <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer">
              <img
                src={photo.url}
                alt={`Photo ${index + 1} of ${complaint.photos.length}`}
                className="h-28 w-28 rounded-md border object-cover"
              />
            </a>
          ))}
        </div>
      ) : null}
      {complaint.response ? (
        <div className="rounded-md border border-primary/40 p-3 text-sm">
          <p className="font-medium">Reply to the student</p>
          <p className="mt-1 whitespace-pre-wrap">{complaint.response}</p>
        </div>
      ) : null}
      <PermissionGate permissions={['complaints:resolve']}>
        {/* Keyed by version so the next valid status is picked again after each change. */}
        <StatusForm key={complaint.version} complaint={complaint} />
      </PermissionGate>
      <PermissionGate permissions={['complaints:assign']}>
        <AssignForm complaint={complaint} />
      </PermissionGate>
      <Notes complaint={complaint} />
      <section>
        <h3 className="mb-2 text-sm font-semibold">History</h3>
        <ol className="space-y-1 text-sm text-muted-foreground">
          {complaint.history.map((entry) => (
            <li key={`${entry.toStatus}-${entry.createdAt}`}>
              {formatDateTime(entry.createdAt)}: {STATUS[entry.toStatus].label}
              {entry.actorName ? ` by ${entry.actorName}` : ' (submitted)'}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Submitter({ complaint }: { complaint: AdminComplaintDetail }) {
  if (complaint.submitter) {
    const { fullName, referenceNumber, blockName } = complaint.submitter;
    return (
      <span className="text-foreground">
        {fullName} ({referenceNumber}
        {blockName ? `, ${blockName}` : ''})
      </span>
    );
  }
  return (
    <span className="text-foreground">
      {complaint.privacyMode === 'ANONYMOUS' ? 'Anonymous' : 'Hidden (anonymous mode is on)'}
    </span>
  );
}

function useRefreshComplaints() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['admin-complaints'] });
}

/** BR-CMP-4: only the next valid steps; closing needs a reply the student will see. */
function StatusForm({ complaint }: { complaint: AdminComplaintDetail }) {
  const id = useId();
  const refresh = useRefreshComplaints();
  const options = NEXT_STATUSES[complaint.status];
  const [status, setStatus] = useState<ComplaintStatus | ''>(options[0] ?? '');
  const [response, setResponse] = useState(complaint.response ?? '');
  const [problem, setProblem] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (body: { status: ComplaintStatus; response?: string }) =>
      changeComplaintStatus(complaint.id, { ...body, version: complaint.version }),
    onSuccess: (updated) => {
      toast.success(
        // Anonymous submitters cannot be reached (BR-CMP-2).
        complaint.privacyMode === 'PRIVATE_IDENTIFIED'
          ? `Marked ${STATUS[updated.status].label}. The student was notified.`
          : `Marked ${STATUS[updated.status].label}.`,
      );
      refresh();
    },
  });
  if (options.length === 0) return null;
  const onSave = () => {
    const parsed = changeComplaintStatusRequestSchema.safeParse({
      status,
      response: response.trim() || undefined,
      version: complaint.version,
    });
    if (!parsed.success) {
      setProblem(parsed.error.issues[0]?.message ?? 'Check the form');
      return;
    }
    setProblem(null);
    mutation.mutate({ status: parsed.data.status, response: parsed.data.response });
  };
  return (
    <section className="space-y-3 rounded-md border p-3">
      <h3 className="text-sm font-semibold">Update status</h3>
      <Field label="New status" htmlFor={`${id}-status`}>
        <Select
          id={`${id}-status`}
          value={status}
          onChange={(event) => setStatus(event.target.value as ComplaintStatus)}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {STATUS[option].label}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="Reply to the student"
        htmlFor={`${id}-response`}
        hint="Required to resolve or reject. The student sees this; internal notes stay private."
        error={problem ?? undefined}
      >
        <Textarea
          id={`${id}-response`}
          value={response}
          maxLength={2000}
          onChange={(event) => setResponse(event.target.value)}
        />
      </Field>
      {mutation.error ? (
        <p className="text-sm text-destructive">{errorMessage(mutation.error)}</p>
      ) : null}
      <Button onClick={onSave} disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving…' : 'Save status'}
      </Button>
    </section>
  );
}

function AssignForm({ complaint }: { complaint: AdminComplaintDetail }) {
  const id = useId();
  const refresh = useRefreshComplaints();
  const assignees = useQuery({ queryKey: ['complaint-assignees'], queryFn: listAssignees });
  const mutation = useMutation({
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
    <section className="space-y-2">
      <Field label="Assigned to" htmlFor={`${id}-assignee`}>
        <Select
          id={`${id}-assignee`}
          value={complaint.assignedTo?.id ?? ''}
          disabled={mutation.isPending || assignees.isLoading}
          onChange={(event) => mutation.mutate(event.target.value || null)}
        >
          <option value="">Nobody</option>
          {(assignees.data ?? []).map((staff) => (
            <option key={staff.id} value={staff.id}>
              {staff.fullName}
            </option>
          ))}
        </Select>
      </Field>
      {mutation.error ? (
        <p className="text-sm text-destructive">{errorMessage(mutation.error)}</p>
      ) : null}
    </section>
  );
}

/** Internal notes are never visible to students (BR-CMP-1). */
function Notes({ complaint }: { complaint: AdminComplaintDetail }) {
  const id = useId();
  const refresh = useRefreshComplaints();
  const [body, setBody] = useState('');
  const mutation = useMutation({
    mutationFn: () => addComplaintNote(complaint.id, body.trim()),
    onSuccess: () => {
      setBody('');
      toast.success('Note added.');
      refresh();
    },
  });
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Internal notes (staff only)</h3>
      {complaint.notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {complaint.notes.map((note) => (
            <li key={note.id} className="rounded-md bg-muted p-2 text-sm">
              <p className="whitespace-pre-wrap">{note.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {note.authorName}, {formatDateTime(note.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
      <PermissionGate permissions={['complaints:note']}>
        <Field label="Add a note" htmlFor={`${id}-note`}>
          <Textarea
            id={`${id}-note`}
            value={body}
            maxLength={2000}
            onChange={(event) => setBody(event.target.value)}
          />
        </Field>
        {mutation.error ? (
          <p className="text-sm text-destructive">{errorMessage(mutation.error)}</p>
        ) : null}
        <Button
          variant="outline"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || body.trim().length === 0}
        >
          {mutation.isPending ? 'Adding…' : 'Add note'}
        </Button>
      </PermissionGate>
    </section>
  );
}
