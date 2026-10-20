import { describe, expect, it } from 'vitest';
import {
  calculateTicketExpiry,
  formatResetCode,
  isTicketUsable,
  RESET_CODE_ALPHABET,
  RESET_CODE_LENGTH,
} from './credential-reset';

const NOW = new Date('2026-10-20T05:30:00.000Z');
const live = {
  expiresAt: calculateTicketExpiry(NOW),
  usedAt: null,
  invalidatedAt: null,
  failedAttempts: 0,
};

describe('credential reset tickets (ADR-0019)', () => {
  it('expires after 24 hours', () => {
    expect(calculateTicketExpiry(NOW).toISOString()).toBe('2026-10-21T05:30:00.000Z');
    expect(isTicketUsable(live, new Date('2026-10-21T05:29:59.000Z'))).toBe(true);
    expect(isTicketUsable(live, new Date('2026-10-21T05:30:00.000Z'))).toBe(false);
  });

  it('is single use, can be invalidated, and stops after five wrong attempts', () => {
    expect(isTicketUsable({ ...live, usedAt: NOW }, NOW)).toBe(false);
    expect(isTicketUsable({ ...live, invalidatedAt: NOW }, NOW)).toBe(false);
    expect(isTicketUsable({ ...live, failedAttempts: 4 }, NOW)).toBe(true);
    expect(isTicketUsable({ ...live, failedAttempts: 5 }, NOW)).toBe(false);
  });

  it('formats codes from the unambiguous alphabet', () => {
    const code = formatResetCode(Uint8Array.from({ length: 16 }, (_, index) => index * 17));
    expect(code).toHaveLength(RESET_CODE_LENGTH);
    expect([...code].every((char) => RESET_CODE_ALPHABET.includes(char))).toBe(true);
    expect(code).not.toMatch(/[01IO]/);
  });
});
