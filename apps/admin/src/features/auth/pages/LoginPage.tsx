import { zodResolver } from '@hookform/resolvers/zod';
import { staffLoginRequestSchema, totpCodeSchema } from '@ennel/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { type z } from 'zod';
import { errorMessage } from '@/shared/api-client/api-error';
import { Button } from '@/shared/components/ui/button';
import { Field, Input } from '@/shared/components/ui/form-controls';
import { login, verifyTotp } from '../api/auth-api';
import { useAuth } from '../auth-context';

type LoginInput = z.input<typeof staffLoginRequestSchema>;
type LoginOutput = z.output<typeof staffLoginRequestSchema>;

/** Staff sign-in (Admin §B): password, then a TOTP code when 2FA is on. */
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
    <main className="flex min-h-screen items-center justify-center bg-mint p-4">
      <section className="w-full max-w-sm rounded-lg bg-background p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-primary">ENNEL staff sign-in</h1>
        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-danger/30 bg-danger-surface p-3 text-sm text-danger"
          >
            {errorMessage(error)}
          </p>
        ) : null}
        {challengeToken ? (
          <form
            className="mt-6 space-y-4"
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
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoFocus
              />
            </Field>
            <Button type="submit" className="w-full" disabled={verify.isPending}>
              {verify.isPending ? 'Checking…' : 'Verify'}
            </Button>
          </form>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={form.handleSubmit((values) => signIn.mutate(values))}
            noValidate
          >
            <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
              <Input id="email" type="email" autoComplete="username" {...form.register('email')} />
            </Field>
            <Field
              label="Password"
              htmlFor="password"
              error={form.formState.errors.password?.message}
            >
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...form.register('password')}
              />
            </Field>
            <Button type="submit" className="w-full" disabled={signIn.isPending}>
              {signIn.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}
