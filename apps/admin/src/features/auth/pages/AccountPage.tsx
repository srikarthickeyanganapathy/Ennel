import { totpCodeSchema } from '@ennel/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { errorMessage } from '@/shared/api-client/api-error';
import { QueryBoundary } from '@/shared/components/QueryStates';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardHeader } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogFooter } from '@/shared/components/ui/dialog';
import { Field, Input } from '@/shared/components/ui/form-controls';
import { PageHeader } from '@/shared/layout/PageHeader';
import { formatDateTime } from '@/shared/lib/format';
import { confirmTotp, enrollTotp, listSessions, revokeAllSessions } from '../api/auth-api';
import { formatRoles } from '@/features/staff/constants/role-labels';
import { useAuth } from '../auth-context';

/** Admin §B: own sessions, "log out everywhere" and optional two-factor sign-in. */
export function AccountPage() {
  const { me, reloadMe, signOut } = useAuth();
  const navigate = useNavigate();
  const sessions = useQuery({ queryKey: ['staff-sessions'], queryFn: listSessions });
  const [isConfirmingLogout, setIsConfirmingLogout] = useState(false);
  const revokeAll = useMutation({
    mutationFn: revokeAllSessions,
    onSuccess: async () => {
      await signOut();
      navigate('/login');
    },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Account and security" breadcrumbs={[{ label: 'Account' }]} />
      <Card>
        <CardHeader
          title={me?.fullName ?? ''}
          description={me?.email}
          actions={
            <Button variant="outline" asChild>
              <Link to="/change-password">Change password</Link>
            </Button>
          }
        />
        <p className="text-sm text-muted-foreground">
          Roles: {formatRoles(me?.roles ?? []) || 'none'}
        </p>
      </Card>
      <TotpCard isEnabled={me?.totpEnabled ?? false} onEnabled={reloadMe} />
      <Card>
        <CardHeader
          title="Signed-in devices"
          actions={
            <Button variant="destructive" onClick={() => setIsConfirmingLogout(true)}>
              Log out everywhere
            </Button>
          }
        />
        <QueryBoundary
          isLoading={sessions.isLoading}
          error={sessions.error}
          onRetry={() => void sessions.refetch()}
        >
          <ul className="divide-y divide-border text-sm">
            {(sessions.data ?? []).map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span className="max-w-md truncate">{session.userAgent ?? 'Unknown device'}</span>
                <span className="text-muted-foreground">
                  Signed in {formatDateTime(session.createdAt)}{' '}
                  {session.isCurrent ? <StatusBadge label="This device" tone="success" /> : null}
                </span>
              </li>
            ))}
          </ul>
        </QueryBoundary>
      </Card>
      <Dialog open={isConfirmingLogout} onOpenChange={setIsConfirmingLogout}>
        <DialogContent
          title="Log out everywhere?"
          description="Every device, including this one, will be signed out."
        >
          {revokeAll.error ? (
            <p className="text-sm text-danger">{errorMessage(revokeAll.error)}</p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmingLogout(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={revokeAll.isPending}
              onClick={() => revokeAll.mutate()}
            >
              Log out everywhere
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TotpCard({
  isEnabled,
  onEnabled,
}: {
  isEnabled: boolean;
  onEnabled: () => Promise<void>;
}) {
  const [code, setCode] = useState('');
  const enroll = useMutation({ mutationFn: enrollTotp });
  const confirm = useMutation({
    mutationFn: confirmTotp,
    onSuccess: async () => {
      toast.success('Two-factor sign-in is on.');
      await onEnabled();
    },
  });
  const codeCheck = totpCodeSchema.safeParse(code);

  return (
    <Card>
      <CardHeader
        title="Two-factor sign-in"
        description="Ask for a code from an authenticator app after your password."
        actions={
          isEnabled ? <StatusBadge label="On" tone="success" /> : <StatusBadge label="Off" />
        }
      />
      {!isEnabled && !enroll.data ? (
        <div className="space-y-2">
          <Button onClick={() => enroll.mutate()} disabled={enroll.isPending}>
            {enroll.isPending ? 'Starting…' : 'Set up two-factor sign-in'}
          </Button>
          {enroll.error ? (
            <p role="alert" className="text-sm text-danger">
              {errorMessage(enroll.error)}
            </p>
          ) : null}
        </div>
      ) : null}
      {!isEnabled && enroll.data ? (
        <div className="space-y-3 text-sm">
          <p>
            Add this key to your authenticator app (time-based, 6 digits), then enter the code it
            shows.
          </p>
          <p className="break-all rounded bg-surface p-2 font-mono">{enroll.data.secret}</p>
          <Field
            label="Code"
            htmlFor="totp-code"
            error={confirm.error ? errorMessage(confirm.error) : undefined}
          >
            <Input
              id="totp-code"
              inputMode="numeric"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="max-w-40"
            />
          </Field>
          <Button
            disabled={!codeCheck.success || confirm.isPending}
            onClick={() => codeCheck.success && confirm.mutate(codeCheck.data)}
          >
            Turn on
          </Button>
        </div>
      ) : null}
      {isEnabled ? (
        <p className="text-sm text-muted-foreground">
          If you lose your device, a Super Admin can reset two-factor sign-in for you.
        </p>
      ) : null}
    </Card>
  );
}
