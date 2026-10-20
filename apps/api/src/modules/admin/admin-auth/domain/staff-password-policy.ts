import { STAFF_PASSWORD_MIN_LENGTH } from '@ennel/shared';

/**
 * BR-AUTH-3 staff password policy. Length is also checked by the shared schema; the rules
 * that need the account (email) or the old hash live here.
 */
export function findStaffPasswordProblem(password: string, email: string): string | null {
  if (password.length < STAFF_PASSWORD_MIN_LENGTH) {
    return `Use at least ${STAFF_PASSWORD_MIN_LENGTH} characters`;
  }
  const normalized = password.trim().toLowerCase();
  if (normalized === email.toLowerCase()) return 'The password must not be your email address';
  const localPart = email.split('@')[0]?.toLowerCase() ?? '';
  if (localPart.length >= 4 && normalized === localPart) {
    return 'The password must not be your email name';
  }
  return null;
}
