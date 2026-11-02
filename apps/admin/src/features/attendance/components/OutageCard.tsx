import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { WifiOff } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { usePermissions } from '@/features/auth/auth-context';
import { ReasonDialog } from '@/shared/components/ReasonDialog';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Card } from '@/shared/components/ui/card';
import { Switch } from '@/shared/components/ui/switch';
import { formatDateTime } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { getOutage, setOutage } from '../api/attendance-api';

/**
 * Figma "Attendance outage" card for outage mode (Admin §I, BR-NS-7). Outage mode covers every
 * meal window while it is on and holds No-shows for review, so the design's per-slot "mark as
 * down" button has no rule behind it and is not shown.
 */
export function OutageCard() {
  const can = usePermissions();
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
    <Card
      className={cn('flex flex-col gap-2.5', active && 'border-warning bg-warning-surface')}
      role={active ? 'alert' : undefined}
    >
      <div className="flex items-center gap-2">
        <WifiOff aria-hidden className="size-[18px] text-muted-foreground" />
        <h2 className="flex-1 text-base font-semibold">Attendance outage</h2>
        {can('attendance:outage-toggle') ? (
          <Switch
            label="Attendance outage"
            isOn={active !== null}
            disabled={outage.isLoading}
            onToggle={() => (toggle.reset(), setIsChanging(true))}
          />
        ) : (
          <StatusBadge label={active ? 'On' : 'Off'} tone={active ? 'warning' : 'neutral'} />
        )}
      </div>
      <p className="text-[13px] text-muted-foreground">
        {active
          ? `On since ${formatDateTime(active.startedAt)} (${active.reason}, by ${active.startedByName}). Mark students at the counter; No-shows for these meals are held for review.`
          : 'Turn this on when face verification is down. No-shows for meals during the outage are held for review instead of counted.'}
      </p>
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
    </Card>
  );
}
