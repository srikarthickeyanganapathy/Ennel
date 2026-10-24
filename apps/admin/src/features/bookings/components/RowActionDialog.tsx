import {
  type AdminBooking,
  type AdminMeal,
  CORRECTABLE_STATUSES,
  type DietType,
} from '@ennel/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ReasonDialog } from '@/shared/components/ReasonDialog';
import { Field, Select } from '@/shared/components/ui/form-controls';
import { cancelBooking, correctBookingStatus, moveBooking } from '../api/bookings-api';
import { BOOKING_STATUS_DISPLAY, DIET_LABELS, MEAL_LABELS } from '../constants/booking-display';

export interface RowAction {
  kind: 'cancel' | 'move' | 'status';
  booking: AdminBooking;
}

interface RowActionDialogProps {
  action: RowAction | null;
  meals: AdminMeal[];
  onClose: () => void;
  onDone: () => void;
}

const TITLES = {
  cancel: 'Cancel booking?',
  move: 'Move to another slot',
  status: 'Correct status',
};
const CONFIRM = { cancel: 'Cancel booking', move: 'Move booking', status: 'Save status' };

/**
 * Admin §H single-booking overrides. Each needs a reason, may bypass student deadlines, and is
 * shown to the student as "Updated by mess staff". The booking's version guards against
 * overwriting a colleague's change.
 */
export function RowActionDialog({ action, meals, onClose, onDone }: RowActionDialogProps) {
  const [slotId, setSlotId] = useState('');
  const [dietType, setDietType] = useState<DietType>('VEG');
  const [status, setStatus] = useState<(typeof CORRECTABLE_STATUSES)[number]>('BOOKED');
  const booking = action?.booking;
  const slots =
    meals
      .find((meal) => meal.mealType === booking?.mealType)
      ?.slots.filter((slot) => slot.isActive && slot.id !== booking?.slotId) ?? [];

  useEffect(() => {
    if (!booking) return;
    setSlotId('');
    setDietType(booking.dietType);
    setStatus(CORRECTABLE_STATUSES.find((value) => value !== booking.status) ?? 'BOOKED');
  }, [booking]);

  const save = useMutation({
    mutationFn: (reason: string) => {
      if (!action) throw new Error('No booking selected');
      const { id, version } = action.booking;
      if (action.kind === 'cancel') return cancelBooking(id, { reason, version });
      if (action.kind === 'move') return moveBooking(id, { slotId, dietType, reason, version });
      return correctBookingStatus(id, { status, reason, version });
    },
    onSuccess: () => {
      toast.success('Booking updated. The student sees "Updated by mess staff".');
      onDone();
    },
    onError: (error) => {
      // A colleague changed it: reload so the next attempt uses the current version.
      if ((error as { code?: string }).code === 'VERSION_CONFLICT') onDone();
    },
  });

  if (!action || !booking) return null;
  return (
    <ReasonDialog
      open
      onOpenChange={(open) => !open && (save.reset(), onClose())}
      title={TITLES[action.kind]}
      description={`${booking.studentName} (${booking.referenceNumber}) · ${MEAL_LABELS[booking.mealType]}, ${booking.slotLabel}`}
      confirmLabel={CONFIRM[action.kind]}
      isDestructive={action.kind === 'cancel'}
      isPending={save.isPending}
      error={save.error}
      onConfirm={(reason) => {
        if (action.kind === 'move' && !slotId) return;
        save.mutate(reason);
      }}
    >
      {action.kind === 'move' ? (
        <>
          <Field label="New slot" htmlFor="move-slot" error={slotId ? undefined : 'Choose a slot'}>
            <Select
              id="move-slot"
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
          <Field label="Meal type" htmlFor="move-diet">
            <Select
              id="move-diet"
              value={dietType}
              onChange={(event) => setDietType(event.target.value as DietType)}
            >
              {(['VEG', 'NON_VEG'] as const).map((value) => (
                <option key={value} value={value}>
                  {DIET_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
        </>
      ) : null}
      {action.kind === 'status' ? (
        <Field
          label="New status"
          htmlFor="correct-status"
          hint="No-show corrections are made in no-show review, which also updates the student's count."
        >
          <Select
            id="correct-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
          >
            {CORRECTABLE_STATUSES.filter((value) => value !== booking.status).map((value) => (
              <option key={value} value={value}>
                {BOOKING_STATUS_DISPLAY[value].label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
    </ReasonDialog>
  );
}
