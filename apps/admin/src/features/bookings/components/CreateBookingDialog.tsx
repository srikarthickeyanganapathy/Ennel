import { type AdminMeal, type DietType, type MealType } from '@ennel/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ReasonDialog } from '@/shared/components/ReasonDialog';
import { Field, Input, Select } from '@/shared/components/ui/form-controls';
import { listStudents } from '@/features/students/api/students-api';
import { createBooking } from '../api/bookings-api';
import { DIET_LABELS, MEAL_LABELS } from '../constants/booking-display';

interface CreateBookingDialogProps {
  open: boolean;
  date: string;
  meals: AdminMeal[];
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/** Admin §H: book a meal on a student's behalf, with a reason, bypassing student deadlines. */
export function CreateBookingDialog({
  open,
  date,
  meals,
  onOpenChange,
  onDone,
}: CreateBookingDialogProps) {
  const [search, setSearch] = useState('');
  const [studentId, setStudentId] = useState('');
  const [mealType, setMealType] = useState<MealType>('LUNCH');
  const [slotId, setSlotId] = useState('');
  const [dietType, setDietType] = useState<DietType>('VEG');
  const students = useQuery({
    queryKey: ['students', 'booking-search', search],
    queryFn: () => listStudents({ q: search, registration: 'REGISTERED', page: 1, pageSize: 10 }),
    enabled: open && search.trim().length >= 2,
  });
  const slots =
    meals.find((meal) => meal.mealType === mealType)?.slots.filter((slot) => slot.isActive) ?? [];

  useEffect(() => {
    if (open) {
      setSearch('');
      setStudentId('');
      setSlotId('');
    }
  }, [open]);

  const create = useMutation({
    mutationFn: (reason: string) =>
      createBooking({ studentId, date, mealType, slotId, dietType, reason }),
    onSuccess: () => {
      toast.success('Booking created.');
      onDone();
    },
  });

  const isComplete = Boolean(studentId && slotId);
  return (
    <ReasonDialog
      open={open}
      onOpenChange={(next) => (create.reset(), onOpenChange(next))}
      title="Book for a student"
      description={`For ${date}. Student deadlines do not apply to staff bookings.`}
      confirmLabel="Create booking"
      isPending={create.isPending}
      error={create.error}
      onConfirm={(reason) => isComplete && create.mutate(reason)}
    >
      <Field
        label="Find student"
        htmlFor="booking-student-search"
        hint="Type at least 2 letters of the name or reference number"
      >
        <Input
          id="booking-student-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </Field>
      <Field
        label="Student"
        htmlFor="booking-student"
        error={studentId ? undefined : 'Choose a registered student'}
      >
        <Select
          id="booking-student"
          value={studentId}
          onChange={(event) => setStudentId(event.target.value)}
        >
          <option value="">{students.isFetching ? 'Searching…' : 'Choose a student'}</option>
          {(students.data?.items ?? [])
            .filter((item) => item.studentId)
            .map((item) => (
              <option key={item.rosterEntryId} value={item.studentId ?? ''}>
                {item.fullName} ({item.referenceNumber})
              </option>
            ))}
        </Select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Meal" htmlFor="booking-meal">
          <Select
            id="booking-meal"
            value={mealType}
            onChange={(event) => (setMealType(event.target.value as MealType), setSlotId(''))}
          >
            {meals.map((meal) => (
              <option key={meal.id} value={meal.mealType}>
                {MEAL_LABELS[meal.mealType]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Slot" htmlFor="booking-slot" error={slotId ? undefined : 'Choose a slot'}>
          <Select
            id="booking-slot"
            value={slotId}
            onChange={(event) => setSlotId(event.target.value)}
          >
            <option value="">Choose</option>
            {slots.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {slot.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Meal type" htmlFor="booking-diet">
          <Select
            id="booking-diet"
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
      </div>
    </ReasonDialog>
  );
}
