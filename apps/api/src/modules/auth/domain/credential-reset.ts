/**
 * ADR-0019 staff-issued reset codes: valid 24 hours, single use, invalidated after five wrong
 * attempts. The alphabet leaves out look-alike characters (0/O, 1/I) because codes are read
 * aloud or copied by hand.
 */
export const RESET_CODE_LENGTH = 10;
export const RESET_CODE_TTL_HOURS = 24;
export const RESET_CODE_MAX_ATTEMPTS = 5;
export const RESET_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface ResetTicketState {
  expiresAt: Date;
  usedAt: Date | null;
  invalidatedAt: Date | null;
  failedAttempts: number;
}

export function isTicketUsable(ticket: ResetTicketState, now: Date): boolean {
  return (
    ticket.usedAt === null &&
    ticket.invalidatedAt === null &&
    ticket.failedAttempts < RESET_CODE_MAX_ATTEMPTS &&
    ticket.expiresAt.getTime() > now.getTime()
  );
}

export function calculateTicketExpiry(now: Date): Date {
  return new Date(now.getTime() + RESET_CODE_TTL_HOURS * 60 * 60_000);
}

/** Maps random bytes onto the alphabet; 256 % 32 === 0, so there is no modulo bias. */
export function formatResetCode(randomBytes: Uint8Array): string {
  return Array.from(
    randomBytes.slice(0, RESET_CODE_LENGTH),
    (byte) => RESET_CODE_ALPHABET[byte % RESET_CODE_ALPHABET.length],
  ).join('');
}
