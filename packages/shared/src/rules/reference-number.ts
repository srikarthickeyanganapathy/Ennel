/**
 * College reference numbers are compared as digits only, so "24 900 417" and "24900417"
 * are the same student (BR-AUTH-1, Spec §3 Screen 2). The exact college format is
 * unconfirmed (admin-requirements open item 12), so only length is checked.
 */
export const REFERENCE_NUMBER_MIN_DIGITS = 4;
export const REFERENCE_NUMBER_MAX_DIGITS = 20;

export function normalizeReferenceNumber(raw: string): string {
  return raw.replace(/[\s-]/g, '');
}

export function isValidReferenceNumber(normalized: string): boolean {
  const pattern = new RegExp(
    `^\\d{${REFERENCE_NUMBER_MIN_DIGITS},${REFERENCE_NUMBER_MAX_DIGITS}}$`,
  );
  return pattern.test(normalized);
}
