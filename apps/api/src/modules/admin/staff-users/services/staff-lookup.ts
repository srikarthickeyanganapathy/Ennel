import { ErrorCode, type StaffUser } from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';
import { type TransactionClient } from '../../../../infrastructure/database/transaction-runner';
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
