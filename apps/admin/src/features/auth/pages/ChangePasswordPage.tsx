import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordRequestSchema, STAFF_PASSWORD_MIN_LENGTH } from '@ennel/shared';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { type z } from 'zod';
import { ApiError, errorMessage } from '@/shared/api-client/api-error';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Field, Input } from '@/shared/components/ui/form-controls';
import { changePassword } from '../api/auth-api';
import { useAuth } from '../auth-context';

type Input = z.input<typeof changePasswordRequestSchema>;
type Output = z.output<typeof changePasswordRequestSchema>;

/** Own password change, required on first sign-in (Admin §B). Other sessions are signed out. */
export function ChangePasswordPage() {
  const { me, startSession } = useAuth();
  const navigate = useNavigate();
  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver(changePasswordRequestSchema),
  });
  const save = useMutation({
    mutationFn: changePassword,
    onSuccess: async (session) => {
      await startSession(session);
      toast.success('Password changed. Other devices have been signed out.');
      navigate('/', { replace: true });
    },
    onError: (error) => {
      if (!(error instanceof ApiError)) return;
      for (const issue of error.fieldIssues) {
        form.setError(issue.path as keyof Input, { message: issue.message });
      }
    },
  });

  return (
    <div className="mx-auto max-w-md py-10">
      <Card>
        <h1 className="text-xl font-semibold">Change your password</h1>
        {me?.mustChangePassword ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Choose your own password before continuing.
          </p>
        ) : null}
        {save.error && !(save.error instanceof ApiError && save.error.fieldIssues.length > 0) ? (
          <p role="alert" className="mt-4 text-sm text-danger">
            {errorMessage(save.error)}
          </p>
        ) : null}
        <form
          className="mt-6 space-y-4"
          onSubmit={form.handleSubmit((values) => save.mutate(values))}
          noValidate
        >
          <Field
            label="Current password"
            htmlFor="currentPassword"
            error={form.formState.errors.currentPassword?.message}
          >
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              {...form.register('currentPassword')}
            />
          </Field>
          <Field
            label="New password"
            htmlFor="newPassword"
            hint={`At least ${STAFF_PASSWORD_MIN_LENGTH} characters, not your email`}
            error={form.formState.errors.newPassword?.message}
          >
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              {...form.register('newPassword')}
            />
          </Field>
          <Field
            label="Confirm new password"
            htmlFor="confirmPassword"
            error={form.formState.errors.confirmPassword?.message}
          >
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...form.register('confirmPassword')}
            />
          </Field>
          <Button type="submit" className="w-full" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Change password'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
