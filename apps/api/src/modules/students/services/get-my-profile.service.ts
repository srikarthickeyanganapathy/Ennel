import { Injectable } from '@nestjs/common';
import { ErrorCode, type StudentProfile } from '@ennel/shared';
import { AppError } from '../../../common/errors/app-error';
import { Clock } from '../../../infrastructure/clock/clock';
import { FileUrlSigner } from '../../../infrastructure/storage/file-url-signer';
import { GetMessPolicyService } from '../../mess-config/services/get-mess-policy.service';
import { getEditableFields } from '../domain/editable-fields';
import { toStudentProfile } from '../mappers/student-profile.mapper';
import { StudentProfileRepository } from '../repositories/student-profile.repository';

/** Profile with prefilled college data and which fields are editable (Spec §3 Screen 5, §9). */
@Injectable()
export class GetMyProfileService {
  constructor(
    private readonly profiles: StudentProfileRepository,
    private readonly policy: GetMessPolicyService,
    private readonly signer: FileUrlSigner,
    private readonly clock: Clock,
  ) {}

  async execute(studentId: string): Promise<StudentProfile> {
    const [record, policy] = await Promise.all([
      this.profiles.findById(studentId),
      this.policy.execute(),
    ]);
    if (!record) throw new AppError(ErrorCode.NOT_FOUND, 'Student not found.');
    const photoUrl = record.photoKey
      ? this.signer.createUrl(record.photoKey, this.clock.now())
      : null;
    return toStudentProfile(record, getEditableFields(policy.collegeControlledFields), photoUrl);
  }
}
