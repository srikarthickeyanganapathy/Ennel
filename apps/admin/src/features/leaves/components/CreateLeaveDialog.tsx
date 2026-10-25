import { type AdminStudentListItem, type LeaveRange } from '@ennel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { ReasonDialog } from '@/shared/components/ReasonDialog';
import { Field, Input } from '@/shared/components/ui/form-controls';
import { todayBusinessDate } from '@/shared/lib/format';
import { listStudents } from '@/features/students/api/students-api';
import { createLeave } from '../api/leaves-api';
import { MealPointFields } from './MealPointFields';

/**
 * Admin §K: a leave on a student's behalf. It is approved at once; the reason is audited as an
 * override (ADR-0026). Only registered students can have leave.
 */
export function CreateLeaveDialog({ onClose }: { onClose: () => void }) {
  const id = useId();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [student, setStudent] = useState<AdminStudentListItem | null>(null);
  const [range, setRange] = useState<LeaveRange>(() => ({
    startDate: todayBusinessDate(),
    startMealType: 'DINNER',
    endDate: todayBusinessDate(),
    endMealType: 'DINNER',
  }));
  const matches = useQuery({
    queryKey: ['leave-student-search', search],
    queryFn: () => listStudents({ q: search, page: 1, pageSize: 5 }),
    enabled: search.trim().length >= 3 && !student,
  });
  const create = useMutation({
    mutationFn: (reason: string) => {
      if (!student?.studentId) throw new Error('Choose a registered student.');
      return createLeave({ ...range, studentId: student.studentId, reason });
    },
    onSuccess: (result) => {
      toast.success(`Leave added. ${result.bookingsPaused} booked meals paused.`);
      onClose();
      void queryClient.invalidateQueries({ queryKey: ['admin-leaves'] });
    },
  });
  const pick = (item: AdminStudentListItem) => (setStudent(item), setSearch(''));

  return (
    <ReasonDialog
      open
      onOpenChange={(isOpen) => (isOpen ? undefined : onClose())}
      title="Add leave for a student"
      description="The leave is approved at once and the student is notified."
      confirmLabel="Add leave"
      isPending={create.isPending}
      error={create.error}
      onConfirm={(reason) => create.mutate(reason)}
    >
      {student ? (
        <p className="text-sm">
          <strong>{student.fullName}</strong> ({student.referenceNumber}){' '}
          <button type="button" className="text-primary underline" onClick={() => setStudent(null)}>
            Change
          </button>
        </p>
      ) : (
        <Field label="Student (name or reference number)" htmlFor={id}>
          <Input id={id} value={search} onChange={(event) => setSearch(event.target.value)} />
          <ul className="mt-1 space-y-1">
            {(matches.data?.items ?? []).map((item) => (
              <li key={item.rosterEntryId}>
                <button
                  type="button"
                  disabled={!item.studentId}
                  className="w-full rounded-md border border-border px-2 py-1 text-left text-sm hover:bg-mint disabled:opacity-50"
                  onClick={() => pick(item)}
                >
                  {item.fullName} · {item.referenceNumber}
                  {item.studentId ? '' : ' (not registered)'}
                </button>
              </li>
            ))}
          </ul>
        </Field>
      )}
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
