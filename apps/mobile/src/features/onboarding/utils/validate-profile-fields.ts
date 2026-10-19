import { profileFieldSchemas, type StudentProfileField } from '@ennel/shared';
import { type ProfileDraft } from '../store/onboarding-draft.store';

export type FieldErrors = Partial<Record<keyof ProfileDraft, string>>;

/**
 * Checks the given draft fields with the same shared schemas the API uses, so a student sees
 * problems before submitting. The API still validates everything (Spec §14).
 */
export function validateProfileFields(
  draft: ProfileDraft,
  fields: readonly StudentProfileField[],
  optionalFields: readonly StudentProfileField[] = [],
): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of fields) {
    const value = draft[field];
    if (optionalFields.includes(field) && (value === '' || value === null)) continue;
    if (value === null || value === '') {
      errors[field] =
        field === 'hostelBlockId' ? 'Choose your hostel block' : 'This field is required';
      continue;
    }
    const result = profileFieldSchemas[field].safeParse(value);
    if (!result.success) errors[field] = result.error.issues[0]?.message ?? 'Check this field';
  }
  return errors;
}
