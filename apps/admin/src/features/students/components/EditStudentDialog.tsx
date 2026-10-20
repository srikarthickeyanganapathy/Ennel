import { type AdminHostel, type AdminStudentDetail } from '@ennel/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ReasonDialog } from '@/shared/components/ReasonDialog';
import { Field, Input, Select } from '@/shared/components/ui/form-controls';
import { updateStudent } from '../api/students-api';

interface EditStudentDialogProps {
  student: AdminStudentDetail;
  hostels: AdminHostel[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Corrects college-controlled fields (Admin §G); only changed values are sent. */
export function EditStudentDialog({
  student,
  hostels,
  open,
  onOpenChange,
}: EditStudentDialogProps) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState(() => initialValues(student));
  useEffect(() => {
    if (open) setValues(initialValues(student));
  }, [open, student]);

  const save = useMutation({
    mutationFn: (reason: string) => {
      const original = initialValues(student);
      const changes = Object.fromEntries(
        Object.entries(values).filter(
          ([key, value]) => value !== original[key as keyof typeof original],
        ),
      );
      return updateStudent(student.rosterEntryId, {
        ...changes,
        academicYear: changes.academicYear ? Number(changes.academicYear) : undefined,
        hostelBlockId: 'hostelBlockId' in changes ? changes.hostelBlockId || null : undefined,
        roomNumber: 'roomNumber' in changes ? changes.roomNumber || null : undefined,
        email: 'email' in changes ? changes.email || null : undefined,
        reason,
        rosterVersion: student.rosterVersion,
      });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['student', student.rosterEntryId], updated);
      toast.success('Student details saved.');
      onOpenChange(false);
    },
  });

  const set = (key: keyof typeof values) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  return (
    <ReasonDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit college details"
      confirmLabel="Save changes"
      isPending={save.isPending}
      error={save.error}
      onConfirm={(reason) => save.mutate(reason)}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name" htmlFor="edit-name">
          <Input id="edit-name" value={values.fullName} onChange={set('fullName')} />
        </Field>
        <Field label="Department" htmlFor="edit-department">
          <Input id="edit-department" value={values.department} onChange={set('department')} />
        </Field>
        <Field label="Academic year" htmlFor="edit-year">
          <Input
            id="edit-year"
            type="number"
            min={1}
            max={8}
            value={values.academicYear}
            onChange={set('academicYear')}
          />
        </Field>
        <Field label="Hostel block" htmlFor="edit-block">
          <Select id="edit-block" value={values.hostelBlockId} onChange={set('hostelBlockId')}>
            <option value="">None</option>
            {hostels.flatMap((hostel) =>
              hostel.blocks.map((block) => (
                <option key={block.id} value={block.id}>
                  {hostel.name} • {block.name}
                </option>
              )),
            )}
          </Select>
        </Field>
        <Field label="Room" htmlFor="edit-room">
          <Input id="edit-room" value={values.roomNumber} onChange={set('roomNumber')} />
        </Field>
        <Field label="Email" htmlFor="edit-email">
          <Input id="edit-email" type="email" value={values.email} onChange={set('email')} />
        </Field>
      </div>
    </ReasonDialog>
  );
}

function initialValues(student: AdminStudentDetail) {
  return {
    fullName: student.fullName,
    department: student.department,
    academicYear: String(student.academicYear),
    hostelBlockId: student.hostelBlockId ?? '',
    roomNumber: student.roomNumber ?? '',
    email: student.email ?? '',
  };
}
