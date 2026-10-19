import { createHash, randomBytes } from 'node:crypto';

/**
 * Refresh tokens are 256-bit random values. Only a SHA-256 hash is stored: the token has
 * enough entropy that a slow hash adds nothing, and lookups stay indexed (ADR-0015).
 */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
