import { type AdminMeal, type AdminSlot } from '@ennel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage, isVersionConflict } from '@/shared/api-client/api-error';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/shared/components/ui/dialog';
import { Field, Input } from '@/shared/components/ui/form-controls';
import { formatBusinessDate, minuteToTimeInput, timeInputToMinute } from '@/shared/lib/format';
import { createSlot, getCapacityImpact, updateSlot } from '../api/mess-config-api';

interface SlotFormDialogProps {
  meal: AdminMeal;
  slot: AdminSlot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Add or edit a slot; lowering capacity warns with the dates it affects (Admin §D). */
export function SlotFormDialog({ meal, slot, open, onOpenChange }: SlotFormDialogProps) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState({ start: '', end: '', capacity: '' });
  useEffect(() => {
    if (!open) return;
    setValues({
      start: minuteToTimeInput(slot?.startMinute ?? meal.serviceStartMinute),
      end: minuteToTimeInput(slot?.endMinute ?? meal.serviceStartMinute + 30),
      capacity: String(slot?.defaultCapacity ?? ''),
    });
  }, [open, slot, meal]);

  const capacity = Number(values.capacity);
  const isLowering = slot !== null && values.capacity !== '' && capacity < slot.defaultCapacity;
  const impact = useQuery({
    queryKey: ['capacity-impact', slot?.id, capacity],
    queryFn: () => getCapacityImpact(slot?.id ?? '', { capacity, scope: 'DEFAULT' }),
    enabled: isLowering,
  });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        startMinute: timeInputToMinute(values.start),
        endMinute: timeInputToMinute(values.end),
        defaultCapacity: capacity,
      };
      return slot
        ? updateSlot(slot.id, { ...body, version: slot.version })
        : createSlot({ ...body, mealId: meal.id });
    },
    onSuccess: () => {
      toast.success('Slot saved.');
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: ['mess-config'] });
    },
    // The reloaded slot arrives through props and resets the form to the colleague's values.
    onError: (error) =>
      isVersionConflict(error) && queryClient.invalidateQueries({ queryKey: ['mess-config'] }),
  });
  const { reset: resetSave } = save;
  useEffect(() => {
    if (open) resetSave();
  }, [open, resetSave]);
  const isBreakfast = meal.mealType === 'BREAKFAST';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={slot ? `Edit ${slot.label}` : `Add ${meal.displayName} slot`}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Starts" htmlFor="slot-start">
            <Input
              id="slot-start"
              type="time"
              disabled={isBreakfast}
              value={values.start}
              onChange={(event) => setValues({ ...values, start: event.target.value })}
            />
          </Field>
          <Field label="Ends" htmlFor="slot-end">
            <Input
              id="slot-end"
              type="time"
              disabled={isBreakfast}
              value={values.end}
              onChange={(event) => setValues({ ...values, end: event.target.value })}
            />
          </Field>
          <Field label="Default capacity" htmlFor="slot-capacity">
            <Input
              id="slot-capacity"
              type="number"
              min={0}
              value={values.capacity}
              onChange={(event) => setValues({ ...values, capacity: event.target.value })}
            />
          </Field>
        </div>
        {isLowering && impact.data && impact.data.affectedDates.length > 0 ? (
          <div
            role="alert"
            className="mt-4 rounded-md border border-warning/30 bg-warning-surface p-3 text-sm text-warning"
          >
            <p className="font-semibold">
              Warning: bookings already exceed this capacity on {impact.data.affectedDates.length}{' '}
              days.
            </p>
            <ul className="mt-1 list-disc pl-5">
              {impact.data.affectedDates.slice(0, 7).map((entry) => (
                <li key={entry.mealDate}>
                  {formatBusinessDate(entry.mealDate)}: {entry.bookedCount} booked ({entry.overBy}{' '}
                  over)
                </li>
              ))}
            </ul>
            <p className="mt-1">Existing bookings are kept and will show as over capacity.</p>
          </div>
        ) : null}
        {save.error ? <p className="mt-3 text-sm text-danger">{errorMessage(save.error)}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={save.isPending || values.capacity === ''} onClick={() => save.mutate()}>
            Save slot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
