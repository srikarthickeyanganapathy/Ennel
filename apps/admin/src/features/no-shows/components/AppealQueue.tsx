import { type AdminNoShowEvent, type MealType } from '@ennel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/shared/api-client/api-error';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { QueryBoundary } from '@/shared/components/QueryStates';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/form-controls';
import { formatBusinessDate } from '@/shared/lib/format';
import { approveAppeal, listNoShows } from '../api/no-shows-api';
import { type NoShowAction } from './NoShowActionDialog';

const MEAL_NAMES: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
};

export const APPEALS_QUERY = {
  queryKey: ['admin-no-shows', 'appeals'],
  queryFn: () => listNoShows({ appeal: 'PENDING', page: 1, pageSize: 50 }),
};

/** Figma "No-show appeals" (Admin §J): student reports waiting for a decision, oldest first. */
export function AppealQueue({ onAction }: { onAction: (action: NoShowAction) => void }) {
  const queue = useQuery(APPEALS_QUERY);
  return (
    <QueryBoundary
      isLoading={queue.isLoading}
      error={queue.error}
      onRetry={() => void queue.refetch()}
    >
      {queue.data?.items.length === 0 ? (
        <Card>
          <p className="text-sm text-muted-foreground">No reports are waiting for a decision.</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-4">
          {queue.data?.items.map((event) => (
            <li key={event.id}>
              <AppealCard event={event} onAction={onAction} />
            </li>
          ))}
        </ul>
      )}
    </QueryBoundary>
  );
}

function AppealCard({
  event,
  onAction,
}: {
  event: AdminNoShowEvent;
  onAction: (action: NoShowAction) => void;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const { fullName, referenceNumber } = event.student;
  const approve = useMutation({
    mutationFn: () => approveAppeal(event.appeal?.id ?? '', note.trim() || undefined),
    onSuccess: (result) => {
      toast.success(
        result.isAutoDisabled
          ? `Approved. ${result.count} No-shows still count.`
          : `Approved. ${result.count} No-shows count; Default Booking is on.`,
      );
      void queryClient.invalidateQueries({ queryKey: ['admin-no-shows'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <Card className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2.5">
        <div className="min-w-0 leading-tight">
          <p className="text-[13px] font-semibold">{fullName}</p>
          <p className="text-xs text-muted-foreground">
            {referenceNumber} · {MEAL_NAMES[event.mealType]} ·{' '}
            {formatBusinessDate(event.date, 'EEE d MMM')} · {event.currentCount} counted
            {event.isAutoDisabled ? ' · Default Booking off' : ''}
          </p>
        </div>
        <StatusBadge label="Pending" tone="warning" />
      </div>
      <p className="rounded-md bg-surface px-3 py-2.5 text-[13px]">“{event.appeal?.message}”</p>
      <PermissionGate permissions={['no-shows:review-appeal']}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            aria-label={`Note for ${fullName}`}
            placeholder="Add a note (optional)"
            maxLength={500}
            className="h-12 flex-1"
            value={note}
            onChange={(change) => setNote(change.target.value)}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-12 flex-1 border-[1.5px] border-danger/30 text-danger hover:bg-danger-surface hover:text-danger sm:flex-none"
              aria-label={`Reject report from ${fullName}`}
              onClick={() => onAction({ kind: 'reject', event, note })}
            >
              Reject
            </Button>
            <Button
              className="h-12 flex-[2] font-semibold sm:flex-none"
              aria-label={`Approve report from ${fullName} and remove the No-show`}
              disabled={approve.isPending}
              onClick={() => approve.mutate()}
            >
              Approve · remove No-show
            </Button>
          </div>
        </div>
      </PermissionGate>
    </Card>
  );
}
