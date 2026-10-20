import { zodResolver } from '@hookform/resolvers/zod';
import {
  createStaffRequestSchema,
  StaffRole,
  type StaffWithTemporaryPassword,
} from '@ennel/shared';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { type z } from 'zod';
import { errorMessage } from '@/shared/api-client/api-error';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/shared/components/ui/dialog';
import { Checkbox, Field, Input } from '@/shared/components/ui/form-controls';
import { createStaff } from '../api/staff-api';
import { ROLE_LABELS } from '../constants/role-labels';

type Input = z.input<typeof createStaffRequestSchema>;
type Output = z.output<typeof createStaffRequestSchema>;

interface CreateStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (result: StaffWithTemporaryPassword) => void;
}

export function CreateStaffDialog({ open, onOpenChange, onCreated }: CreateStaffDialogProps) {
  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver(createStaffRequestSchema),
    defaultValues: { email: '', fullName: '', roles: [] },
  });
  const create = useMutation({
    mutationFn: createStaff,
    onSuccess: (result) => {
      form.reset();
      onCreated(result);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Add staff member"
        description="They sign in with a temporary password and must change it."
      >
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => create.mutate(values))}
          noValidate
        >
          <Field
            label="Full name"
            htmlFor="staff-name"
            error={form.formState.errors.fullName?.message}
          >
            <Input id="staff-name" {...form.register('fullName')} />
          </Field>
          <Field label="Email" htmlFor="staff-email" error={form.formState.errors.email?.message}>
            <Input id="staff-email" type="email" {...form.register('email')} />
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Roles</legend>
            {Object.values(StaffRole).map((role) => (
              <label key={role} className="flex items-center gap-2 text-sm">
                <Checkbox value={role} {...form.register('roles')} />
                {ROLE_LABELS[role]}
              </label>
            ))}
            {form.formState.errors.roles ? (
              <p className="text-sm text-danger">{form.formState.errors.roles.message}</p>
            ) : null}
          </fieldset>
          {create.error ? (
            <p role="alert" className="text-sm text-danger">
              {errorMessage(create.error)}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Adding…' : 'Add staff member'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
