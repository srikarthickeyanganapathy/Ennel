import { type PermissionKey } from '@ennel/shared';
import { type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/features/auth/auth-context';
import { LoadingState } from '@/shared/components/QueryStates';

/** Signed-in staff only; a pending forced password change goes to that page first (Admin §B). */
export function RequireAuth() {
  const { status, me } = useAuth();
  const location = useLocation();
  if (status === 'restoring') return <LoadingState label="Checking your session…" />;
  if (status === 'signedOut')
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (me?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  return <Outlet />;
}

interface RequirePermissionProps {
  /** Any one of these opens the page; actions inside check their own permissions. */
  anyOf: PermissionKey[];
  children: ReactNode;
}

export function RequirePermission({ anyOf, children }: RequirePermissionProps) {
  const { permissions } = useAuth();
  if (anyOf.some((key) => permissions.has(key))) return <>{children}</>;
  return (
    <div role="alert" className="rounded-md border border-border bg-surface p-6">
      <h1 className="text-lg font-semibold">No access</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your role does not include this page. Ask a Super Admin if you need it.
      </p>
    </div>
  );
}
