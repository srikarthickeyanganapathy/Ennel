import { randomBytes } from 'node:crypto';

/**
 * A one-time password for a new or reset staff account. 18 random bytes give 24 URL-safe
 * characters, above the 12-character staff minimum (BR-AUTH-3).
 */
export function generateTemporaryPassword(): string {
  return randomBytes(18).toString('base64url');
}
