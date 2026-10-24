import { ErrorCode, type StaffUser } from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';
import { type TransactionClient } from '../../../../infrastructure/database/transaction-runner';
import { assertMayManageAccount } from '../domain/staff-account-rules';
import { type StaffUsersRepository } from '../repositories/staff-users.repository';

export async function requireStaff(
  repository: StaffUsersRepository,
  id: string,
  tx?: TransactionClient,
): Promise<StaffUser> {
  const staff = await repository.findById(id, tx);
  if (!staff) throw new AppError(ErrorCode.NOT_FOUND, 'Staff member not found.');
  return staff;
}

/** The target account, after checking the actor may manage it (assertMayManageAccount). */
export async function requireManageableStaff(
  repository: StaffUsersRepository,
  actorId: string,
  targetId: string,
  tx: TransactionClient,
): Promise<StaffUser> {
  // Sequential: one interactive transaction should not run queries in parallel.
  const actor = await requireStaff(repository, actorId, tx);
  const target = await requireStaff(repository, targetId, tx);
  assertMayManageAccount(actor.roles, target.roles);
  return target;
}

export function versionConflict(): AppError {
  return new AppError(
    ErrorCode.VERSION_CONFLICT,
    'Someone else changed this staff member. Reload and try again.',
  );
}

/** Only fields safe to keep in the audit log. */
export function staffSnapshot(
  staff: StaffUser,
): Pick<StaffUser, 'email' | 'fullName' | 'status' | 'roles'> {
  return { email: staff.email, fullName: staff.fullName, status: staff.status, roles: staff.roles };
}
