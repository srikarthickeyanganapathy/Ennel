import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { ReasonDialog } from '@/shared/components/ReasonDialog';
import { Button } from '@/shared/components/ui/button';
import { formatDateTime } from '@/shared/lib/format';
import { getOutage, setOutage } from '../api/attendance-api';

/**
 * Admin §I outage mode (BR-NS-7): a banner while it is on, and a toggle with a reason for staff
 * allowed to change it.
 */
export function OutageControl() {
  const queryClient = useQueryClient();
  const [isChanging, setIsChanging] = useState(false);
  const outage = useQuery({ queryKey: ['attendance-outage'], queryFn: getOutage });
  const active = outage.data?.active ?? null;
  const toggle = useMutation({
    mutationFn: (reason: string) => setOutage(!active, reason),
    onSuccess: (next) => {
      toast.success(next.active ? 'Outage mode is on.' : 'Outage mode is off.');
      setIsChanging(false);
      void queryClient.invalidateQueries({ queryKey: ['attendance-outage'] });
      void queryClient.invalidateQueries({ queryKey: ['attendance-counter'] });
    },
  });

  return (
    <div
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm ${active ? 'border-warning bg-warning-surface' : 'border-border bg-surface'}`}
      role={active ? 'alert' : undefined}
    >
      <p>
        <strong>Outage mode: {active ? 'ON' : 'OFF'}.</strong>{' '}
        {active
          ? `Since ${formatDateTime(active.startedAt)} (${active.reason}, by ${active.startedByName}). Mark students at the counter; No-shows for these meals are held for review.`
          : 'Turn it on when the face-verification system is down.'}
      </p>
      <PermissionGate permissions={['attendance:outage-toggle']}>
        <Button
          variant={active ? 'outline' : 'destructive'}
          onClick={() => (toggle.reset(), setIsChanging(true))}
        >
          {active ? 'End outage mode' : 'Start outage mode'}
        </Button>
      </PermissionGate>
      <ReasonDialog
        open={isChanging}
        onOpenChange={setIsChanging}
        title={active ? 'End outage mode?' : 'Start outage mode?'}
        description={
          active
            ? 'Attendance goes back to the face-verification system.'
            : 'No-shows for any meal window during the outage will be held for review instead of counted.'
        }
        confirmLabel={active ? 'End outage mode' : 'Start outage mode'}
        isDestructive={!active}
        isPending={toggle.isPending}
        error={toggle.error}
        onConfirm={(reason) => toggle.mutate(reason)}
      />
    </div>
  );
}
