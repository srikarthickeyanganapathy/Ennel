import { ErrorCode } from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';
import {
  type StaffAuthRepository,
  type StaffCredentials,
} from '../repositories/staff-auth.repository';

export async function requireMember(
  staff: StaffAuthRepository,
  staffId: string,
): Promise<StaffCredentials> {
  const member = await staff.findById(staffId);
  if (!member) throw new AppError(ErrorCode.UNAUTHENTICATED, 'Please sign in again.');
  return member;
}
