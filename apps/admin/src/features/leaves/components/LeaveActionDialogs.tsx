import { type AdminLeave, type LeaveRange, type MealType } from '@ennel/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { ReasonDialog } from '@/shared/components/ReasonDialog';
import { correctLeave, endLeave, rejectLeave } from '../api/leaves-api';
import { describeRange } from './leave-labels';
import { MealPointFields } from './MealPointFields';

export type LeaveAction = { kind: 'reject' | 'end' | 'correct'; leave: AdminLeave };

/** Reject, end early and correct: each needs a reason that is kept in the audit log (Admin §K). */
export function LeaveActionDialog({
  action,
  onClose,
}: {
  action: LeaveAction | null;
  onClose: () => void;
}) {
  if (!action) return null;
  if (action.kind === 'reject') return <RejectDialog leave={action.leave} onClose={onClose} />;
  if (action.kind === 'end') return <EndDialog leave={action.leave} onClose={onClose} />;
  return <CorrectDialog leave={action.leave} onClose={onClose} />;
}

function useLeaveMutation<T>(
  run: (input: T) => Promise<unknown>,
  message: string,
  onClose: () => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      toast.success(message);
      onClose();
      void queryClient.invalidateQueries({ queryKey: ['admin-leaves'] });
    },
  });
}

function RejectDialog({ leave, onClose }: { leave: AdminLeave; onClose: () => void }) {
  const reject = useLeaveMutation(
    (reason: string) => rejectLeave(leave.id, leave.version, reason),
    'Leave rejected. The student was told why.',
    onClose,
  );
  return (
    <ReasonDialog
      open
      onOpenChange={(isOpen) => (isOpen ? undefined : onClose())}
      title={`Reject leave for ${leave.student.fullName}?`}
      description={`${describeRange(leave)}. The student sees the reason.`}
      confirmLabel="Reject leave"
      isDestructive
      isPending={reject.isPending}
      error={reject.error}
      onConfirm={(reason) => reject.mutate(reason)}
    />
  );
}

function EndDialog({ leave, onClose }: { leave: AdminLeave; onClose: () => void }) {
  const [resume, setResume] = useState<{ date: string; mealType: MealType }>({
    date: leave.startDate,
    mealType: leave.startMealType,
  });
  const end = useLeaveMutation(
    (reason: string) =>
      endLeave(leave.id, {
        resumeDate: resume.date,
        resumeMealType: resume.mealType,
        version: leave.version,
        reason,
      }),
    'Leave updated. Meals from the resume point are booked again.',
    onClose,
  );
  return (
    <ReasonDialog
      open
      onOpenChange={(isOpen) => (isOpen ? undefined : onClose())}
      title={`End leave early for ${leave.student.fullName}?`}
      description={`${describeRange(leave)}. Choose the first meal to book again; choosing the first day cancels the leave.`}
      confirmLabel="End leave"
      isPending={end.isPending}
      error={end.error}
      onConfirm={(reason) => end.mutate(reason)}
    >
      <MealPointFields
        label="Resume from"
        date={resume.date}
        mealType={resume.mealType}
        onChange={(change) => setResume((current) => ({ ...current, ...change }))}
      />
    </ReasonDialog>
  );
}

function CorrectDialog({ leave, onClose }: { leave: AdminLeave; onClose: () => void }) {
  const [range, setRange] = useState<LeaveRange>({
    startDate: leave.startDate,
    startMealType: leave.startMealType,
    endDate: leave.endDate,
    endMealType: leave.endMealType,
  });
  const correct = useLeaveMutation(
    (reason: string) => correctLeave(leave.id, { ...range, version: leave.version, reason }),
    'Leave corrected. The student was told.',
    onClose,
  );
  return (
    <ReasonDialog
      open
      onOpenChange={(isOpen) => (isOpen ? undefined : onClose())}
      title={`Correct leave for ${leave.student.fullName}`}
      description="Meals that have already started are not changed."
      confirmLabel="Save correction"
      isPending={correct.isPending}
      error={correct.error}
      onConfirm={(reason) => correct.mutate(reason)}
    >
      <MealPointFields
        label="Starts"
        date={range.startDate}
        mealType={range.startMealType}
        onChange={(change) =>
          setRange((current) => ({
            ...current,
            ...(change.date !== undefined && { startDate: change.date }),
            ...(change.mealType && { startMealType: change.mealType }),
          }))
        }
      />
      <MealPointFields
        label="Ends"
        date={range.endDate}
        mealType={range.endMealType}
        onChange={(change) =>
          setRange((current) => ({
            ...current,
            ...(change.date !== undefined && { endDate: change.date }),
            ...(change.mealType && { endMealType: change.mealType }),
          }))
        }
      />
    </ReasonDialog>
  );
}
