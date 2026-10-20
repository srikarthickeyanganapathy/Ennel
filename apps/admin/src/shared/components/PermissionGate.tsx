import { type PermissionKey } from '@ennel/shared';
import { type ReactNode } from 'react';
import { usePermissions } from '@/features/auth/auth-context';

interface PermissionGateProps {
  /** All are required. */
  permissions: PermissionKey[];
  children: ReactNode;
  /** Shown instead of the children, e.g. a disabled button with an explanation. */
  fallback?: ReactNode;
}

/**
 * Hides controls the staff member cannot use (Admin §A). A convenience only: every action is
 * checked again by the API, which is the authority.
 */
export function PermissionGate({ permissions, children, fallback = null }: PermissionGateProps) {
  const can = usePermissions();
  return <>{can(...permissions) ? children : fallback}</>;
}
