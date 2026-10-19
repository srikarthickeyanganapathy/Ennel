import { ErrorCode } from '@ennel/shared';
import { AppError } from '../../../common/errors/app-error';
import { type StudentProfileRepository } from '../repositories/student-profile.repository';

/** Spec §3 Screen 6: the hostel/block must be one of the valid options. */
export async function assertActiveHostelBlock(
  profiles: StudentProfileRepository,
  hostelBlockId: string,
): Promise<void> {
  if (await profiles.isActiveHostelBlock(hostelBlockId)) return;
  throw new AppError(ErrorCode.VALIDATION_FAILED, 'Choose a hostel block from the list.', {
    issues: [{ path: 'hostelBlockId', message: 'Choose a hostel block from the list' }],
  });
}
