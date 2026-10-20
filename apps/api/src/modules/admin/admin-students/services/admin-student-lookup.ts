import { ErrorCode } from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';
import { type TransactionClient } from '../../../../infrastructure/database/transaction-runner';
import {
  type AdminStudentsRepository,
  type RosterTarget,
} from '../repositories/admin-students.repository';

export async function requireRosterTarget(
  students: AdminStudentsRepository,
  rosterEntryId: string,
  tx?: TransactionClient,
): Promise<RosterTarget> {
  const target = await students.findTarget(rosterEntryId, tx);
  if (!target) throw new AppError(ErrorCode.NOT_FOUND, 'Student not found.');
  return target;
}

export async function assertActiveBlock(
  students: AdminStudentsRepository,
  hostelBlockId: string | null | undefined,
): Promise<void> {
  if (!hostelBlockId || (await students.isActiveHostelBlock(hostelBlockId))) return;
  throw new AppError(ErrorCode.VALIDATION_FAILED, 'Choose an active hostel block.', {
    issues: [{ path: 'hostelBlockId', message: 'Choose an active hostel block' }],
  });
}
