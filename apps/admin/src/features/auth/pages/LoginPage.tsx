import { zodResolver } from '@hookform/resolvers/zod';
import { staffLoginRequestSchema, totpCodeSchema } from '@ennel/shared';
import { useMutation } from '@tanstack/react-query';
import { Info, User } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { type z } from 'zod';
import { errorMessage } from '@/shared/api-client/api-error';
import { Button } from '@/shared/components/ui/button';
import { Field, Input } from '@/shared/components/ui/form-controls';
import { login, verifyTotp } from '../api/auth-api';
import { useAuth } from '../auth-context';
import { AuthCard } from '../components/AuthCard';
import { AUTH_ICON, AUTH_INPUT, PasswordInput } from '../components/PasswordInput';

type LoginInput = z.input<typeof staffLoginRequestSchema>;
type LoginOutput = z.output<typeof staffLoginRequestSchema>;

/**
 * Staff sign-in (Admin §B), from the Figma "Admin — Login" frame: password, then a TOTP code when
 * 2FA is on. Sign-in is by email only, and staff passwords are reset by a Super Admin, so the
 * design's "Staff ID" and "Forgot password?" are replaced by what really works.
 */
export function LoginPage() {
  const { status, startSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const form = useForm<LoginInput, unknown, LoginOutput>({
    resolver: zodResolver(staffLoginRequestSchema),
  });
  const destination = (location.state as { from?: string } | null)?.from ?? '/';

  const signIn = useMutation({
    mutationFn: login,
    onSuccess: async (result) => {
      if (result.status === 'TOTP_REQUIRED') {
        setChallengeToken(result.challengeToken);
        return;
      }
      await startSession(result.session);
      navigate(destination, { replace: true });
    },
  });
  const verify = useMutation({
    mutationFn: verifyTotp,
    onSuccess: async (session) => {
      await startSession(session);
      navigate(destination, { replace: true });
    },
  });

  if (status === 'signedIn') return <Navigate to={destination} replace />;

  const submitCode = () => {
    const parsed = totpCodeSchema.safeParse(code);
    if (!parsed.success || !challengeToken) {
      setCodeError(parsed.error?.issues[0]?.message ?? 'Enter the code');
      return;
    }
    setCodeError(null);
    verify.mutate({ challengeToken, code: parsed.data });
  };

  const error = signIn.error ?? verify.error;
  return (
    <AuthCard
      title="Sign in to the staff portal"
      description="For mess managers, kitchen staff, wardens and auditors."
    >
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-danger/30 bg-danger-surface p-3 text-sm text-danger"
        >
          {errorMessage(error)}
        </p>
      ) : null}
      {challengeToken ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => (event.preventDefault(), submitCode())}
        >
          <Field
            label="Authenticator code"
            htmlFor="totp"
            error={codeError ?? undefined}
            hint="Open your authenticator app"
          >
            <Input
              id="totp"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="h-12"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoFocus
            />
          </Field>
          <Button type="submit" className="h-12 w-full font-semibold" disabled={verify.isPending}>
            {verify.isPending ? 'Checking…' : 'Verify'}
          </Button>
          {/* The challenge expires; without this the only way back was reloading the page. */}
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setChallengeToken(null);
              setCode('');
              setCodeError(null);
              verify.reset();
            }}
          >
            Back to sign-in
          </Button>
        </form>
      ) : (
        <form
          className="flex flex-col gap-5"
          onSubmit={form.handleSubmit((values) => signIn.mutate(values))}
          noValidate
        >
          <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
            <span className="relative block">
              <User aria-hidden className={AUTH_ICON} />
              <Input
                id="email"
                type="email"
                autoComplete="username"
                className={AUTH_INPUT}
                {...form.register('email')}
              />
            </span>
          </Field>
          <Field
            label="Password"
            htmlFor="password"
            error={form.formState.errors.password?.message}
          >
            <PasswordInput
              id="password"
              autoComplete="current-password"
              {...form.register('password')}
            />
          </Field>
          <Button type="submit" className="h-12 w-full font-semibold" disabled={signIn.isPending}>
            {signIn.isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      )}
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info aria-hidden className="size-4 shrink-0" />
        Forgot your password? Ask a Super Admin to reset it. Students use the ENNEL app.
      </p>
    </AuthCard>
  );
}
