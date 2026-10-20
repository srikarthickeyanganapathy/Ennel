import { describe, expect, it } from 'vitest';
import { buildOtpauthUrl, encodeBase32, generateTotp, verifyTotp } from './totp';

// RFC 6238 Appendix B test secret (ASCII "12345678901234567890"), SHA-1 column, last 6 digits.
const RFC_SECRET = Buffer.from('12345678901234567890');

describe('TOTP (RFC 6238)', () => {
  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ])('generates the RFC vector at %i seconds', (seconds, code) => {
    expect(generateTotp(RFC_SECRET, new Date(seconds * 1000))).toBe(code);
  });

  it('accepts one step of clock drift either way, not two', () => {
    const now = new Date(1111111111 * 1000);
    const previous = generateTotp(RFC_SECRET, new Date(now.getTime() - 30_000));
    const twoAhead = generateTotp(RFC_SECRET, new Date(now.getTime() + 60_000));
    expect(verifyTotp(RFC_SECRET, previous, now)).toBe(true);
    expect(verifyTotp(RFC_SECRET, twoAhead, now)).toBe(false);
    expect(verifyTotp(RFC_SECRET, '12345', now)).toBe(false);
  });

  it('encodes secrets as RFC 4648 base32', () => {
    expect(encodeBase32(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
    expect(encodeBase32(RFC_SECRET)).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  });

  it('builds an otpauth URL for authenticator apps', () => {
    const url = buildOtpauthUrl(RFC_SECRET, 'admin@ennel.local');
    expect(url).toMatch(/^otpauth:\/\/totp\/ENNEL%3Aadmin%40ennel\.local\?secret=GEZDGNBV/);
    expect(url).toContain('issuer=ENNEL');
  });
});
