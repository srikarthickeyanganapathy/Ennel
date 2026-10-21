import { type AdminMeal, type AdminSlot } from '@ennel/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { usePermissions } from '@/features/auth/auth-context';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { ReasonDialog } from '@/shared/components/ReasonDialog';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { Field, Select } from '@/shared/components/ui/form-controls';
import { deleteSlot, disableSlot, enableSlot } from '../api/mess-config-api';
import { CapacityDialog } from './CapacityDialog';
import { SlotFormDialog } from './SlotFormDialog';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
type LifecycleAction = { kind: 'disable' | 'enable' | 'delete'; slot: AdminSlot };

export function SlotsTable({ meal }: { meal: AdminMeal }) {
  const queryClient = useQueryClient();
  const can = usePermissions();
  // Ids, not snapshots, so the dialogs always show the latest version of the slot.
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [capacityForId, setCapacityForId] = useState<string | null>(null);
  const [lifecycle, setLifecycle] = useState<LifecycleAction | null>(null);
  const [reassignTo, setReassignTo] = useState('');
  const editingSlot = meal.slots.find((slot) => slot.id === editing) ?? null;
  const capacityFor = meal.slots.find((slot) => slot.id === capacityForId) ?? null;
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['mess-config'] });

  const change = useMutation({
    mutationFn: async ({
      action,
      reason,
    }: {
      action: LifecycleAction;
      reason: string;
    }): Promise<void> => {
      if (action.kind === 'enable') await enableSlot(action.slot.id, reason);
      else if (action.kind === 'delete') await deleteSlot(action.slot.id, reason);
      else await disableSlot(action.slot.id, reason, reassignTo || undefined);
    },
    onSuccess: () => {
      toast.success('Slot updated.');
      setLifecycle(null);
      refresh();
    },
  });
  const isBreakfast = meal.mealType === 'BREAKFAST';
  const otherActive = meal.slots.filter((slot) => slot.isActive && slot.id !== lifecycle?.slot.id);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <caption className="sr-only">{meal.displayName} slots</caption>
          <thead className="bg-surface text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Slot</th>
              <th className="px-3 py-2">Default capacity</th>
              <th className="px-3 py-2">Weekday capacities</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {meal.slots.map((slot) => (
              <tr key={slot.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{slot.label}</td>
                <td className="px-3 py-2">{slot.defaultCapacity}</td>
                <td className="px-3 py-2 text-xs">
                  {slot.weekdayCapacities.length === 0
                    ? '—'
                    : slot.weekdayCapacities
                        .map((entry) => `${WEEKDAYS[entry.weekday]} ${entry.capacity}`)
                        .join(', ')}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge
                    label={slot.isActive ? 'Active' : 'Disabled'}
                    tone={slot.isActive ? 'success' : 'neutral'}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" onClick={() => setCapacityForId(slot.id)}>
                      Capacity
                    </Button>
                    {can('mess-config:update') ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setEditing(slot.id)}>
                          Edit
                        </Button>
                        {isBreakfast ? null : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => (
                                setReassignTo(''),
                                setLifecycle({ kind: slot.isActive ? 'disable' : 'enable', slot })
                              )}
                            >
                              {slot.isActive ? 'Disable' : 'Enable'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setLifecycle({ kind: 'delete', slot })}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isBreakfast ? null : (
        <PermissionGate permissions={['mess-config:update']}>
          <Button size="sm" variant="outline" onClick={() => setEditing('new')}>
            Add slot
          </Button>
        </PermissionGate>
      )}
      <SlotFormDialog
        meal={meal}
        slot={editingSlot}
        open={editing === 'new' || editingSlot !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      {capacityFor ? (
        <CapacityDialog
          slot={capacityFor}
          open
          onOpenChange={(open) => !open && setCapacityForId(null)}
        />
      ) : null}
      <ReasonDialog
        open={lifecycle !== null}
        onOpenChange={(open) => !open && (change.reset(), setLifecycle(null))}
        title={
          lifecycle
            ? `${lifecycle.kind === 'delete' ? 'Delete' : lifecycle.kind === 'disable' ? 'Disable' : 'Enable'} ${lifecycle.slot.label}?`
            : ''
        }
        description={
          lifecycle?.kind === 'disable'
            ? 'If students have bookings or saved choices for this slot, choose a slot to move them to.'
            : lifecycle?.kind === 'delete'
              ? 'Only slots that are not in use can be deleted. Otherwise, disable the slot and move its bookings.'
              : undefined
        }
        confirmLabel="Confirm"
        isDestructive={lifecycle?.kind !== 'enable'}
        isPending={change.isPending}
        error={change.error}
        onConfirm={(reason) => lifecycle && change.mutate({ action: lifecycle, reason })}
      >
        {lifecycle?.kind === 'disable' ? (
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
    </div>
  );
}
