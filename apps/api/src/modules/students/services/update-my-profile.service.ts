import { Injectable } from '@nestjs/common';
import { ErrorCode, type StudentProfile } from '@ennel/shared';
import { AppError } from '../../../common/errors/app-error';
import { GetMessPolicyService } from '../../mess-config/services/get-mess-policy.service';
import { findForbiddenFields } from '../domain/editable-fields';
import {
  type ProfileChanges,
  StudentProfileRepository,
} from '../repositories/student-profile.repository';
import { GetMyProfileService } from './get-my-profile.service';
import { assertActiveHostelBlock } from './hostel-block.guard';

export interface UpdateMyProfileCommand {
  changes: ProfileChanges;
  version: number;
}

/** Spec §9 Edit Profile: college-controlled fields are rejected (ADR-0018). */
@Injectable()
export class UpdateMyProfileService {
  constructor(
    private readonly profiles: StudentProfileRepository,
    private readonly policy: GetMessPolicyService,
    private readonly getProfile: GetMyProfileService,
  ) {}

  async execute(studentId: string, command: UpdateMyProfileCommand): Promise<StudentProfile> {
    const policy = await this.policy.execute();
    const forbidden = findForbiddenFields(command.changes, policy.collegeControlledFields);
    if (forbidden.length > 0) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, 'Some details are managed by the college.', {
        issues: forbidden.map((field) => ({ path: field, message: 'Managed by the college' })),
      });
    }
    if (command.changes.hostelBlockId) {
      await assertActiveHostelBlock(this.profiles, command.changes.hostelBlockId);
    }
    const isUpdated = await this.profiles.update(studentId, command.version, command.changes);
    if (!isUpdated) {
      throw new AppError(
        ErrorCode.VERSION_CONFLICT,
        'Your profile changed on another device. Reload and try again.',
      );
    }
    return this.getProfile.execute(studentId);
  }
}
