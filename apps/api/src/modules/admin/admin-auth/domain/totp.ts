import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * RFC 6238 time-based one-time passwords (Admin §B optional 2FA): HMAC-SHA1, 30-second
 * steps, 6 digits, the format every common authenticator app uses.
 */
export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotp(secret: Buffer, now: Date, stepOffset = 0): string {
  const counter = Math.floor(now.getTime() / 1000 / TOTP_STEP_SECONDS) + stepOffset;
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', secret).update(message).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

/** Accepts the current step and one step either side to tolerate clock drift. */
export function verifyTotp(secret: Buffer, code: string, now: Date): boolean {
  const candidate = Buffer.from(code);
  return [-1, 0, 1].some((offset) => {
    const expected = Buffer.from(generateTotp(secret, now, offset));
    return expected.length === candidate.length && timingSafeEqual(expected, candidate);
  });
}

export function encodeBase32(data: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function buildOtpauthUrl(secret: Buffer, accountName: string, issuer = 'ENNEL'): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({
    secret: encodeBase32(secret),
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
