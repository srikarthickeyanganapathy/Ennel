import { type AdminSlot } from '@ennel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { usePermissions } from '@/features/auth/auth-context';
import { errorMessage } from '@/shared/api-client/api-error';
import { ReasonDialog } from '@/shared/components/ReasonDialog';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/shared/components/ui/dialog';
import { Field, Input } from '@/shared/components/ui/form-controls';
import { formatBusinessDate, todayBusinessDate } from '@/shared/lib/format';
import {
  getCapacityImpact,
  listOverrides,
  removeOverride,
  setOverride,
  setWeekdayCapacities,
} from '../api/mess-config-api';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Weekday defaults and per-date overrides for one slot (BR-CAP-1). Overrides need a reason;
 * a date override below current bookings shows how many students are affected first.
 */
export function CapacityDialog({
  slot,
  open,
  onOpenChange,
}: {
  slot: AdminSlot;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const canEdit = usePermissions()('mess-config:update');
  const overrides = useQuery({
    queryKey: ['mess-config', 'overrides', slot.id],
    queryFn: () => listOverrides(slot.id),
  });
  const [weekdays, setWeekdays] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      slot.weekdayCapacities.map((entry) => [entry.weekday, String(entry.capacity)]),
    ),
  );
  const [override, setOverrideValues] = useState({
    date: todayBusinessDate(),
    capacity: '',
    reason: '',
  });
  const overrideCapacity = Number(override.capacity);
  const impact = useQuery({
    queryKey: ['capacity-impact', slot.id, 'date', override.date, overrideCapacity],
    queryFn: () =>
      getCapacityImpact(slot.id, {
        capacity: overrideCapacity,
        scope: 'DATE',
        date: override.date,
      }),
    enabled: override.capacity !== '' && override.date !== '',
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['mess-config'] });

  const saveWeekdays = useMutation({
    mutationFn: () =>
      setWeekdayCapacities(slot.id, {
        capacities: WEEKDAYS.map((_, weekday) => ({
          weekday,
          capacity: weekdays[weekday] ? Number(weekdays[weekday]) : null,
        })),
      }),
    onSuccess: () => (toast.success('Weekday capacities saved.'), refresh()),
  });
  const addOverride = useMutation({
    mutationFn: () => setOverride(slot.id, override.date, overrideCapacity, override.reason),
    onSuccess: () => {
      toast.success('Date override saved.');
      setOverrideValues({ ...override, capacity: '', reason: '' });
      refresh();
    },
  });
  // Removing an override is an audited change, so staff confirm it and give their own reason.
  const [removingDate, setRemovingDate] = useState<string | null>(null);
  const deleteOverride = useMutation({
    mutationFn: ({ date, reason }: { date: string; reason: string }) =>
      removeOverride(slot.id, date, reason),
    onSuccess: () => {
      toast.success('Date override removed.');
      setRemovingDate(null);
      refresh();
    },
  });
  const affected = impact.data?.affectedDates[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Capacity · ${slot.label}`}
        description={`Default ${slot.defaultCapacity}. A date override beats a weekday capacity, which beats the default.`}
        className="max-w-2xl"
      >
        <section aria-labelledby="weekday-heading" className="space-y-3">
          <h3 id="weekday-heading" className="font-medium">
            Weekday capacities
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {WEEKDAYS.map((name, weekday) => (
              <Field key={name} label={name} htmlFor={`weekday-${weekday}`}>
                <Input
                  id={`weekday-${weekday}`}
                  type="number"
                  min={0}
                  placeholder={String(slot.defaultCapacity)}
                  disabled={!canEdit}
                  value={weekdays[weekday] ?? ''}
                  onChange={(event) => setWeekdays({ ...weekdays, [weekday]: event.target.value })}
                />
              </Field>
            ))}
          </div>
          {canEdit ? (
            <Button
              size="sm"
              disabled={saveWeekdays.isPending}
              onClick={() => saveWeekdays.mutate()}
            >
              Save weekday capacities
            </Button>
          ) : null}
          {saveWeekdays.error ? (
            <p className="text-sm text-danger">{errorMessage(saveWeekdays.error)}</p>
          ) : null}
        </section>
        <section aria-labelledby="override-heading" className="mt-6 space-y-3">
          <h3 id="override-heading" className="font-medium">
            Date overrides (special meals, events)
          </h3>
          <ul className="space-y-1 text-sm">
            {(overrides.data ?? []).map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-2">
                <span>
                  {formatBusinessDate(entry.mealDate)}: {entry.capacity} — {entry.reason}
                </span>
                {canEdit ? (
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Remove override on ${formatBusinessDate(entry.mealDate)}`}
                    onClick={() => (deleteOverride.reset(), setRemovingDate(entry.mealDate))}
                  >
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
            {overrides.data?.length === 0 ? (
              <li className="text-muted-foreground">No upcoming overrides.</li>
            ) : null}
          </ul>
          {canEdit ? (
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label="Date" htmlFor="override-date">
                <Input
                  id="override-date"
                  type="date"
                  min={todayBusinessDate()}
                  value={override.date}
                  onChange={(event) => setOverrideValues({ ...override, date: event.target.value })}
                />
              </Field>
              <Field label="Capacity" htmlFor="override-capacity">
                <Input
                  id="override-capacity"
                  type="number"
                  min={0}
                  value={override.capacity}
                  onChange={(event) =>
                    setOverrideValues({ ...override, capacity: event.target.value })
                  }
                />
              </Field>
              <Field label="Reason" htmlFor="override-reason">
                <Input
                  id="override-reason"
                  value={override.reason}
                  onChange={(event) =>
                    setOverrideValues({ ...override, reason: event.target.value })
                  }
                />
              </Field>
            </div>
          ) : null}
          {affected ? (
            <p
              role="alert"
              className="rounded-md border border-warning/30 bg-warning-surface p-2 text-sm text-warning"
            >
              Warning: {affected.bookedCount} students are already booked ({affected.overBy} over
              this capacity). They keep their bookings.
            </p>
          ) : null}
          {canEdit ? (
            <Button
              size="sm"
              disabled={!override.capacity || !override.reason.trim() || addOverride.isPending}
              onClick={() => addOverride.mutate()}
            >
              Save override
            </Button>
          ) : null}
          {addOverride.error ? (
            <p className="text-sm text-danger">{errorMessage(addOverride.error)}</p>
          ) : null}
        </section>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
        <ReasonDialog
          open={removingDate !== null}
          onOpenChange={(isOpen) => !isOpen && setRemovingDate(null)}
          title={`Remove the override on ${formatBusinessDate(removingDate)}?`}
          description="The weekday or default capacity applies to that date again."
          confirmLabel="Remove override"
          isDestructive
          isPending={deleteOverride.isPending}
          error={deleteOverride.error}
          onConfirm={(reason) =>
            removingDate && deleteOverride.mutate({ date: removingDate, reason })
          }
        />
      </DialogContent>
    </Dialog>
  );
}
