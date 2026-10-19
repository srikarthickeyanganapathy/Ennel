import { describe, expect, it } from 'vitest';
import { redact } from './redact';

describe('redact', () => {
  it('masks secrets and personal data at any depth', () => {
    expect(
      redact({
        password: 'x',
        user: { email: 'a@b.c', referenceNumber: '24900417', role: 'WARDEN' },
        headers: { authorization: 'Bearer abc' },
      }),
    ).toEqual({
      password: '[REDACTED]',
      user: { email: '[REDACTED]', referenceNumber: '[REDACTED]', role: 'WARDEN' },
      headers: { authorization: '[REDACTED]' },
    });
  });

  it('keeps error codes readable', () => {
    expect(redact({ code: 'SLOT_UNAVAILABLE' })).toEqual({ code: 'SLOT_UNAVAILABLE' });
  });
});
