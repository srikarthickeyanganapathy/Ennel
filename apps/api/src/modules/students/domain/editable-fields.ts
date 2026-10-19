import { STUDENT_PROFILE_FIELDS, type StudentProfileField } from '@ennel/shared';

/** Spec §9 Edit Profile, ADR-0018: college-controlled fields are read-only for students. */
export function getEditableFields(
  collegeControlledFields: readonly string[],
): StudentProfileField[] {
  const controlled = new Set(collegeControlledFields);
  return STUDENT_PROFILE_FIELDS.filter((field) => !controlled.has(field));
}

/** Fields in `changes` that the student is not allowed to edit. */
export function findForbiddenFields(
  changes: Partial<Record<StudentProfileField, unknown>>,
  collegeControlledFields: readonly string[],
): StudentProfileField[] {
  const editable = new Set(getEditableFields(collegeControlledFields));
  return STUDENT_PROFILE_FIELDS.filter(
    (field) => changes[field] !== undefined && !editable.has(field),
  );
}

/**
 * Onboarding may resend prefilled college values; only editable ones are kept, so a
 * resubmitted controlled field is ignored rather than rejected (Spec §3 Screen 5).
 */
export function pickEditableChanges<T extends Partial<Record<StudentProfileField, unknown>>>(
  changes: T,
  collegeControlledFields: readonly string[],
): Partial<T> {
  const editable = new Set<string>(getEditableFields(collegeControlledFields));
  return Object.fromEntries(
    Object.entries(changes).filter(([field, value]) => value !== undefined && editable.has(field)),
  ) as Partial<T>;
}
