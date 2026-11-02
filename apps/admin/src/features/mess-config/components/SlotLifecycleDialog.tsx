import { type AdminMeal, type AdminSlot } from '@ennel/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { ReasonDialog } from '@/shared/components/ReasonDialog';
import { Field, Select } from '@/shared/components/ui/form-controls';
import { deleteSlot, disableSlot, enableSlot } from '../api/mess-config-api';

export type SlotLifecycleAction = { kind: 'disable' | 'enable' | 'delete'; slot: AdminSlot };

const VERBS = { delete: 'Delete', disable: 'Disable', enable: 'Enable' } as const;

/** Disable (with reassign), enable or delete a slot; each needs a reason (Admin §D). */
export function SlotLifecycleDialog({
  meal,
  action,
  onClose,
}: {
  meal: AdminMeal;
  action: SlotLifecycleAction | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [reassignTo, setReassignTo] = useState('');
  const change = useMutation({
    mutationFn: async ({
      target,
      reason,
    }: {
      target: SlotLifecycleAction;
      reason: string;
    }): Promise<void> => {
      if (target.kind === 'enable') await enableSlot(target.slot.id, reason);
      else if (target.kind === 'delete') await deleteSlot(target.slot.id, reason);
      else await disableSlot(target.slot.id, reason, reassignTo || undefined);
    },
    onSuccess: () => {
      toast.success('Slot updated.');
      setReassignTo('');
      onClose();
      void queryClient.invalidateQueries({ queryKey: ['mess-config'] });
    },
  });
  const otherActive = meal.slots.filter((slot) => slot.isActive && slot.id !== action?.slot.id);
  return (
    <ReasonDialog
      open={action !== null}
      onOpenChange={(open) => {
        if (open) return;
        change.reset();
        setReassignTo('');
        onClose();
      }}
      title={action ? `${VERBS[action.kind]} ${action.slot.label}?` : ''}
      description={
        action?.kind === 'disable'
          ? 'If students have bookings or saved choices for this slot, choose a slot to move them to.'
          : action?.kind === 'delete'
            ? 'Only slots that are not in use can be deleted. Otherwise, disable the slot and move its bookings.'
            : undefined
      }
      confirmLabel="Confirm"
      isDestructive={action?.kind !== 'enable'}
      isPending={change.isPending}
      error={change.error}
      onConfirm={(reason) => action && change.mutate({ target: action, reason })}
    >
      {action?.kind === 'disable' ? (
        <Field
          label="Move bookings and choices to"
          htmlFor="reassign-slot"
          hint="Leave empty if the slot is not in use"
        >
          <Select
            id="reassign-slot"
            value={reassignTo}
            onChange={(event) => setReassignTo(event.target.value)}
          >
            <option value="">Do not move</option>
            {otherActive.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {slot.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
    </ReasonDialog>
  );
}
