import { type AdminMeal, type BulkBookingAction, type MealType } from '@ennel/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ReasonDialog } from '@/shared/components/ReasonDialog';
import { Field, Select } from '@/shared/components/ui/form-controls';
import { applyBulkBookings, previewBulkBookings } from '../api/bookings-api';

interface BulkBookingDialogProps {
  action: BulkBookingAction | null;
  bookingIds: string[];
  meals: AdminMeal[];
  /** The selection's meal, when all selected bookings share one (needed for MOVE). */
  mealType: MealType | null;
  onClose: () => void;
  onDone: () => void;
}

/** Admin §H bulk actions: a preview of affected and skipped bookings before applying. */
export function BulkBookingDialog({
  action,
  bookingIds,
  meals,
  mealType,
  onClose,
  onDone,
}: BulkBookingDialogProps) {
  const [slotId, setSlotId] = useState('');
  useEffect(() => setSlotId(''), [action]);
  const isReady = action === 'CANCEL' || (action === 'MOVE' && slotId !== '');
  const request = { action: action ?? 'CANCEL', bookingIds, slotId: slotId || undefined };
  const preview = useQuery({
    queryKey: ['bookings', 'bulk-preview', request],
    queryFn: () => previewBulkBookings(request),
    enabled: action !== null && isReady,
  });
  const apply = useMutation({
    mutationFn: (reason: string) => applyBulkBookings({ ...request, reason }),
    onSuccess: (result) => {
      const skipped = result.skipped.length > 0 ? `, ${result.skipped.length} skipped` : '';
      toast.success(`${result.affected.length} bookings updated${skipped}.`);
      onDone();
    },
  });

  if (!action) return null;
  const slots =
    meals.find((meal) => meal.mealType === mealType)?.slots.filter((slot) => slot.isActive) ?? [];
  return (
    <ReasonDialog
      open
      onOpenChange={(open) => !open && (apply.reset(), onClose())}
      title={
        action === 'CANCEL'
          ? `Cancel ${bookingIds.length} bookings?`
          : `Move ${bookingIds.length} bookings`
      }
      confirmLabel={action === 'CANCEL' ? 'Cancel bookings' : 'Move bookings'}
      isDestructive={action === 'CANCEL'}
      isPending={apply.isPending}
      error={apply.error ?? preview.error}
      onConfirm={(reason) =>
        isReady && (preview.data?.affected.length ?? 0) > 0 && apply.mutate(reason)
      }
    >
      {action === 'MOVE' ? (
        mealType ? (
          <Field label="Move to slot" htmlFor="bulk-slot">
            <Select
              id="bulk-slot"
              value={slotId}
              onChange={(event) => setSlotId(event.target.value)}
            >
              <option value="">Choose a slot</option>
              {slots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <p role="alert" className="text-sm text-danger">
            Select bookings of one meal to move them together.
          </p>
        )
      ) : null}
      <Preview
        isLoading={preview.isFetching}
        affected={preview.data?.affected.length}
        skipped={preview.data?.skipped ?? []}
      />
    </ReasonDialog>
  );
}

function Preview({
  isLoading,
  affected,
  skipped,
}: {
  isLoading: boolean;
  affected?: number;
  skipped: { id: string; reason: string }[];
}) {
  if (isLoading)
    return <p className="text-sm text-muted-foreground">Checking the selected bookings…</p>;
  if (affected === undefined) return null;
  return (
    <div className="rounded-md border border-border p-3 text-sm" aria-live="polite">
      <p className="font-medium">{affected} will be changed.</p>
      {skipped.length > 0 ? (
        <>
          <p className="mt-2 text-muted-foreground">{skipped.length} will be skipped:</p>
          <ul className="mt-1 list-disc pl-5">
            {skipped.slice(0, 10).map((item) => (
              <li key={item.id}>{item.reason}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
