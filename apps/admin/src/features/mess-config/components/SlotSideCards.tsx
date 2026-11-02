import { type MessPolicyView, type SlotAvailability, type Thresholds } from '@ennel/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { usePermissions } from '@/features/auth/auth-context';
import { cancelSentence } from '@/features/policy/components/rule-sentences';
import { isVersionConflict } from '@/shared/api-client/api-error';
import { ReasonDialog } from '@/shared/components/ReasonDialog';
import { Card } from '@/shared/components/ui/card';
import { Switch } from '@/shared/components/ui/switch';
import { cn } from '@/shared/lib/utils';
import { updatePolicy } from '../api/mess-config-api';
import { STATUS_DISPLAY } from '../constants/slot-status';

/** Figma "Over-capacity policy": the rule 8 flag, saved with a reason like any policy change. */
export function OverCapacityCard({ policy }: { policy: MessPolicyView }) {
  const queryClient = useQueryClient();
  const canEdit = usePermissions()('policy:update');
  const [isChanging, setIsChanging] = useState(false);
  const isOn = policy.allowOverCapacityBooking;
  const save = useMutation({
    mutationFn: (reason: string) =>
      updatePolicy({ allowOverCapacityBooking: !isOn, reason, version: policy.version }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['policy'], updated);
      void queryClient.invalidateQueries({ queryKey: ['policy-history'] });
      void queryClient.invalidateQueries({ queryKey: ['mess-config'] });
      toast.success('Over-capacity policy saved.');
      setIsChanging(false);
    },
    onError: (error) => {
      if (isVersionConflict(error)) void queryClient.invalidateQueries({ queryKey: ['policy'] });
    },
  });
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">Over-capacity policy</h2>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Allow bookings above capacity</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Off: full slots close and students pick another time.
          </p>
        </div>
        <Switch
          label="Allow bookings above capacity"
          isOn={isOn}
          disabled={!canEdit}
          onToggle={() => (save.reset(), setIsChanging(true))}
        />
      </div>
      <p className="flex items-start gap-2.5 rounded-md bg-warning-surface p-3 text-[13px]">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
        Turning this on lets queues build at popular slots. It needs institutional approval.
      </p>
      <ReasonDialog
        open={isChanging}
        onOpenChange={setIsChanging}
        title={isOn ? 'Stop bookings above capacity?' : 'Allow bookings above capacity?'}
        description="This applies immediately to students."
        confirmLabel="Save"
        isPending={save.isPending}
        error={save.error}
        onConfirm={(reason) => save.mutate(reason)}
      />
    </Card>
  );
}

/** Figma "What students see": today's fullest slot, with the numbers and label students get. */
export function StudentPreviewCard({ slots }: { slots: SlotAvailability[] }) {
  const fullest = [...slots].sort((a, b) => b.occupancyPct - a.occupancyPct)[0];
  if (!fullest) return null;
  const display = STATUS_DISPLAY[fullest.status];
  const seatsLeft = Math.max(0, fullest.officialCapacity - fullest.bookedCount);
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold">What students see</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Today’s fullest slot</p>
      </div>
      <div className="flex flex-col gap-2 rounded-md border border-border bg-surface px-3.5 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[15px] font-semibold">{fullest.label}</p>
          <p className={cn('text-[13px] whitespace-nowrap', display.text)}>
            {seatsLeft} {seatsLeft === 1 ? 'seat' : 'seats'} left
          </p>
        </div>
        <span aria-hidden className="h-1 overflow-hidden rounded-sm bg-neutral-surface">
          <span
            className={cn('block h-full', display.bar)}
            style={{ width: `${Math.min(100, fullest.occupancyPct)}%` }}
          />
        </span>
        <p className={cn('text-xs font-medium', display.text)}>
          {display.label}
          {fullest.isRecommended ? ' · Recommended' : ''}
        </p>
      </div>
    </Card>
  );
}

/** Figma "Rules in plain words", from the values in force rather than fixed text. */
export function PlainRulesCard({
  thresholds,
  policy,
}: {
  thresholds: Thresholds;
  policy: MessPolicyView | null;
}) {
  const rules = [
    ...(policy ? [cancelSentence(policy.cancellationCutoffMinutes)] : []),
    `“Filling fast” shows at ${thresholds.fillingFastThresholdPct}% booked.`,
    `“Recommended” marks the least busy slot, up to ${thresholds.recommendedMaxOccupancyPct}% booked.`,
  ];
  return (
    <Card className="flex flex-col gap-2">
      <h2 className="text-base font-semibold">Rules in plain words</h2>
      <ul className="flex flex-col gap-2">
        {rules.map((rule) => (
          <li key={rule} className="flex items-start gap-2 text-[13px]">
            <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-success" strokeWidth={3} />
            {rule}
          </li>
        ))}
      </ul>
    </Card>
  );
}
