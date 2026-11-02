import { zodResolver } from '@hookform/resolvers/zod';
import { staffLoginRequestSchema, totpCodeSchema } from '@ennel/shared';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, Info, Lock, User, Utensils } from 'lucide-react';
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

const LARGE_INPUT = 'h-12 rounded-md border-[1.5px] border-border pl-10 text-[15px] shadow-none';
const FIELD_ICON =
  'pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground';

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
  const [isPasswordShown, setIsPasswordShown] = useState(false);
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
  const PasswordIcon = isPasswordShown ? EyeOff : Eye;
  return (
    <main className="flex min-h-screen items-center justify-center bg-mint p-4">
      <section className="flex w-full max-w-[440px] flex-col gap-5 rounded-lg bg-background px-6 pt-8 pb-7 shadow-[0_8px_24px_rgba(0,0,0,0.08)] sm:px-10 sm:pt-10 sm:pb-9">
        <div className="flex items-center gap-2.5">
          <span className="rounded-sm bg-primary p-2 text-primary-foreground">
            <Utensils aria-hidden className="size-5" />
          </span>
          <span className="leading-tight">
            <span className="block text-xl font-bold text-primary">ENNEL</span>
            <span className="block text-xs font-semibold text-muted-foreground">Mess Admin</span>
          </span>
        </div>
        <div>
          <h1 className="text-[22px] leading-tight font-semibold text-foreground">
            Sign in to the staff portal
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            For mess managers, kitchen staff, wardens and auditors.
          </p>
        </div>
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
                <User aria-hidden className={FIELD_ICON} />
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  className={LARGE_INPUT}
                  {...form.register('email')}
                />
              </span>
            </Field>
            <Field
              label="Password"
              htmlFor="password"
              error={form.formState.errors.password?.message}
            >
              <span className="relative block">
                <Lock aria-hidden className={FIELD_ICON} />
                <Input
                  id="password"
                  type={isPasswordShown ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`${LARGE_INPUT} pr-11`}
                  {...form.register('password')}
                />
                <button
                  type="button"
                  aria-label={isPasswordShown ? 'Hide the password' : 'Show the password'}
                  aria-pressed={isPasswordShown}
                  className="absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                  onClick={() => setIsPasswordShown(!isPasswordShown)}
                >
                  <PasswordIcon aria-hidden className="size-[18px]" />
                </button>
              </span>
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
      </section>
    </main>
  );
}
