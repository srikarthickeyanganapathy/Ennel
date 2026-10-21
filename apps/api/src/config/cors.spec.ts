import { describe, expect, it } from 'vitest';
import { isAllowedOrigin } from './cors';

const ADMIN = 'http://localhost:5173';

describe('isAllowedOrigin', () => {
  it('always allows the admin dashboard and requests without an origin', () => {
    expect(isAllowedOrigin(ADMIN, { nodeEnv: 'production', adminWebOrigin: ADMIN })).toBe(true);
    expect(isAllowedOrigin(undefined, { nodeEnv: 'production', adminWebOrigin: ADMIN })).toBe(true);
  });

  it('allows other localhost origins only in development', () => {
    const expoWeb = 'http://localhost:8081';
    expect(isAllowedOrigin(expoWeb, { nodeEnv: 'development', adminWebOrigin: ADMIN })).toBe(true);
    expect(isAllowedOrigin(expoWeb, { nodeEnv: 'production', adminWebOrigin: ADMIN })).toBe(false);
  });

  it('never allows other hosts', () => {
    const config = { nodeEnv: 'development' as const, adminWebOrigin: ADMIN };
    expect(isAllowedOrigin('http://evil.example', config)).toBe(false);
    expect(isAllowedOrigin('http://localhost.evil.example:8081', config)).toBe(false);
  });
});
