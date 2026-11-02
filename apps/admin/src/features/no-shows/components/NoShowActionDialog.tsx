import { type AdminNoShowEvent } from '@ennel/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ReasonDialog } from '@/shared/components/ReasonDialog';
import { formatBusinessDate } from '@/shared/lib/format';
import { reEnableDefaultBooking, rejectAppeal, resetCount, reviewHeld } from '../api/no-shows-api';

export type NoShowAction = {
  kind: 'reject' | 'confirm' | 'dismiss' | 'reset' | 'reEnable';
  event: AdminNoShowEvent;
  /** Reject only: the note typed on the appeal card, as the starting reason. */
  note?: string;
};

const MEAL_NAMES = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', DINNER: 'Dinner' } as const;

/** Every No-show decision needs a reason that is kept in the audit log (Admin §J). */
const TEXT: Record<
  NoShowAction['kind'],
  { title: string; description: string; confirm: string; done: string }
> = {
  reject: {
    title: 'Reject this report?',
    description: 'The No-show keeps counting. The student sees your reason.',
    confirm: 'Reject report',
    done: 'Report rejected. The student was told why.',
  },
  confirm: {
    title: 'Confirm this No-show?',
    description: 'It was held because outage mode was on. Confirming makes it count.',
    confirm: 'Confirm No-show',
    done: 'No-show confirmed.',
  },
  dismiss: {
    title: 'Dismiss this No-show?',
    description: 'It was held because outage mode was on. Dismissing removes it from the count.',
    confirm: 'Dismiss No-show',
    done: 'No-show dismissed.',
  },
  reset: {
    title: 'Reset this student’s count?',
    description:
      'Every counted No-show for this meal in the window stops counting. Default Booking is not switched back on by this.',
    confirm: 'Reset count',
    done: 'Count reset.',
  },
  reEnable: {
    title: 'Switch Default Booking back on?',
    description: 'Upcoming meals are booked again from the student’s saved choices.',
    confirm: 'Switch back on',
    done: 'Default Booking switched back on.',
  },
};

function run(action: NoShowAction, reason: string) {
  const { event } = action;
  if (action.kind === 'reject') return rejectAppeal(event.appeal?.id ?? '', reason);
  if (action.kind === 'confirm' || action.kind === 'dismiss')
    return reviewHeld(event.id, action.kind, reason);
  if (action.kind === 'reset') return resetCount(event.student.id, event.mealType, reason);
  return reEnableDefaultBooking(event.student.id, event.mealType, reason);
}

export function NoShowActionDialog({
  action,
  onClose,
}: {
  action: NoShowAction | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (reason: string) =>
      action ? run(action, reason) : Promise.reject(new Error('No action')),
    onSuccess: () => {
      if (action) toast.success(TEXT[action.kind].done);
      onClose();
      void queryClient.invalidateQueries({ queryKey: ['admin-no-shows'] });
    },
  });
  if (!action) return null;
  const text = TEXT[action.kind];
  const { event } = action;
  return (
    <ReasonDialog
      open
      onOpenChange={(isOpen) => (isOpen ? undefined : onClose())}
      title={text.title}
      description={`${event.student.fullName}, ${MEAL_NAMES[event.mealType]} on ${formatBusinessDate(event.date)}. ${text.description}`}
      confirmLabel={text.confirm}
      initialReason={action.note}
      isDestructive={action.kind === 'reject' || action.kind === 'reset'}
      isPending={mutation.isPending}
      error={mutation.error}
      onConfirm={(reason) => mutation.mutate(reason)}
    />
  );
}
