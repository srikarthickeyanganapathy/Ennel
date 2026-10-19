import { type StudentProfile, type StudentProfileField } from '@ennel/shared';
import { type StudentProfileRecord } from '../repositories/student-profile.repository';

export function toStudentProfile(
  record: StudentProfileRecord,
  editableFields: StudentProfileField[],
  photoUrl: string | null,
): StudentProfile {
  const { photoKey: _photoKey, ...profile } = record;
  return { ...profile, photoUrl, editableFields };
}
