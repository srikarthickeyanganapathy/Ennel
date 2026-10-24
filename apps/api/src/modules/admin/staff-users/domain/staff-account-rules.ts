import { ErrorCode, StaffRole } from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';

/**
 * Safety rule for the staff directory: the system can never be left without an active
 * Super Admin, because only a Super Admin can manage staff and roles (Admin §A).
 */
export function assertSuperAdminRemains(activeSuperAdminsAfterChange: number): void {
  if (activeSuperAdminsAfterChange >= 1) return;
  throw new AppError(
    ErrorCode.VALIDATION_FAILED,
    'At least one active Super Admin must remain. Assign another Super Admin first.',
  );
}

/** Staff cannot disable or demote themselves; another administrator must do it. */
export function assertNotSelf(actorId: string, targetId: string, action: string): void {
  if (actorId !== targetId) return;
  throw new AppError(ErrorCode.VALIDATION_FAILED, `You cannot ${action} your own account.`);
}

export function isSuperAdmin(roles: readonly string[]): boolean {
  return roles.includes(StaffRole.SUPER_ADMIN);
}

/**
 * Only a Super Admin may reset, disable, enable or edit another Super Admin's account; otherwise
 * staff:manage alone would let someone take over the highest-privilege account (Admin §A, §B).
 */
export function assertMayManageAccount(
  actorRoles: readonly string[],
  targetRoles: readonly string[],
): void {
  if (!isSuperAdmin(targetRoles) || isSuperAdmin(actorRoles)) return;
  throw new AppError(
    ErrorCode.PERMISSION_DENIED,
    "Only a Super Admin can change a Super Admin's account.",
  );
}
