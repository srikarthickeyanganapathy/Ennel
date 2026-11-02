import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordRequestSchema, STAFF_PASSWORD_MIN_LENGTH } from '@ennel/shared';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { type z } from 'zod';
import { ApiError, errorMessage } from '@/shared/api-client/api-error';
import { Button } from '@/shared/components/ui/button';
import { Field } from '@/shared/components/ui/form-controls';
import { changePassword } from '../api/auth-api';
import { useAuth } from '../auth-context';
import { AuthCard } from '../components/AuthCard';
import { PasswordInput } from '../components/PasswordInput';

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
    <AuthCard
      title="Change your password"
      description={
        me?.mustChangePassword ? 'Choose your own password before continuing.' : undefined
      }
    >
      {save.error && !(save.error instanceof ApiError && save.error.fieldIssues.length > 0) ? (
        <p
          role="alert"
          className="rounded-md border border-danger/30 bg-danger-surface p-3 text-sm text-danger"
        >
          {errorMessage(save.error)}
        </p>
      ) : null}
      <form
        className="flex flex-col gap-5"
        onSubmit={form.handleSubmit((values) => save.mutate(values))}
        noValidate
      >
        <Field
          label="Current password"
          htmlFor="currentPassword"
          error={form.formState.errors.currentPassword?.message}
        >
          <PasswordInput
            id="currentPassword"
            subject="the current password"
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
          <PasswordInput
            id="newPassword"
            subject="the new password"
            autoComplete="new-password"
            {...form.register('newPassword')}
          />
        </Field>
        <Field
          label="Confirm new password"
          htmlFor="confirmPassword"
          error={form.formState.errors.confirmPassword?.message}
        >
          <PasswordInput
            id="confirmPassword"
            subject="the confirmation"
            autoComplete="new-password"
            {...form.register('confirmPassword')}
          />
        </Field>
        <Button type="submit" className="h-12 w-full font-semibold" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Change password'}
        </Button>
        {/* This page sits outside the app layout; a voluntary change needs a way back. */}
        {me?.mustChangePassword ? null : (
          <Button variant="ghost" className="w-full font-semibold text-primary" asChild>
            <Link to="/account">Cancel</Link>
          </Button>
        )}
      </form>
    </AuthCard>
  );
}
