import { type AttendanceLookup, type AttendanceWindowQuery } from '@ennel/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useId, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/shared/api-client/api-error';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { ReasonDialog } from '@/shared/components/ReasonDialog';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Input, Label } from '@/shared/components/ui/form-controls';
import { formatDateTime } from '@/shared/lib/format';
import { lookupStudent, markPresent } from '../api/attendance-api';
import { BOOKING_STATUS_TEXT, SOURCE_TEXT } from '../constants/attendance-labels';

/** Admin §I: search or scan a reference number and mark the student present. */
export function CounterSearch({ target }: { target: AttendanceWindowQuery }) {
  const id = useId();
  const queryClient = useQueryClient();
  const [reference, setReference] = useState('');
  const [result, setResult] = useState<AttendanceLookup | null>(null);
  const [isAskingReason, setIsAskingReason] = useState(false);
  const lookup = useMutation({
    mutationFn: (value: string) => lookupStudent(target, value),
    onSuccess: setResult,
    onError: () => setResult(null),
  });
  const mark = useMutation({
    mutationFn: (reason?: string) =>
      markPresent({ ...target, referenceNumber: result?.student.referenceNumber ?? '', reason }),
    onSuccess: (next) => {
      setResult(next);
      setIsAskingReason(false);
      toast.success(`${next.student.fullName} marked present.`);
      setReference('');
      void queryClient.invalidateQueries({ queryKey: ['attendance-counter'] });
    },
  });

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    if (reference.trim() === '') return;
    mark.reset();
    lookup.mutate(reference.trim());
  };

  return (
    <Card className="p-4">
      <form onSubmit={onSearch} className="flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1 space-y-1.5">
          <Label htmlFor={id}>Reference number</Label>
          <Input
            id={id}
            value={reference}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Scan or type, e.g. 24900417"
            onChange={(event) => setReference(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={lookup.isPending}>
          {lookup.isPending ? 'Searching…' : 'Search'}
        </Button>
      </form>
      {lookup.error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {errorMessage(lookup.error)}
        </p>
      ) : null}
      {result ? (
        <div className="mt-4 rounded-md border border-border p-3" aria-live="polite">
          <p className="font-semibold">
            {result.student.fullName}{' '}
            <span className="text-sm font-normal text-muted-foreground">
              {result.student.referenceNumber}
              {result.student.blockName ? ` · ${result.student.blockName}` : ''}
            </span>
          </p>
          <p className="mt-1 text-sm">
            {result.booking
              ? `${result.booking.slotLabel} · ${result.booking.dietType === 'VEG' ? 'Veg' : 'Non-Veg'} · ${BOOKING_STATUS_TEXT[result.booking.status]}`
              : 'No booking for this meal'}
          </p>
          {result.attendance ? (
            <p className="mt-1 text-sm">
              <StatusBadge label="Present" tone="success" /> {SOURCE_TEXT[result.attendance.source]}
              , {formatDateTime(result.attendance.recordedAt)}
            </p>
          ) : null}
          {result.note ? <p className="mt-2 text-sm text-muted-foreground">{result.note}</p> : null}
          {mark.error ? (
            <p role="alert" className="mt-2 text-sm text-danger">
              {errorMessage(mark.error)}
            </p>
          ) : null}
          {result.canMark ? (
            <PermissionGate permissions={['attendance:mark']}>
              <Button
                className="mt-3"
                disabled={mark.isPending}
                onClick={() =>
                  result.needsReason ? setIsAskingReason(true) : mark.mutate(undefined)
                }
              >
                {mark.isPending ? 'Marking…' : 'Mark present'}
              </Button>
            </PermissionGate>
          ) : null}
        </div>
      ) : null}
      <ReasonDialog
        open={isAskingReason}
        onOpenChange={setIsAskingReason}
        title="Record attendance without a booking?"
        description="This student has no booking for this meal. The reason is kept in the audit log."
        confirmLabel="Mark present"
        isPending={mark.isPending}
        error={mark.error}
        onConfirm={(reason) => mark.mutate(reason)}
      />
    </Card>
  );
}
