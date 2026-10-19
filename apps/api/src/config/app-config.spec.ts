import { describe, expect, it } from 'vitest';
import { parseAppConfig } from './app-config';

const VALID_ENV = {
  DATABASE_URL: 'postgresql://ennel:ennel@localhost:5432/ennel',
  REDIS_URL: 'redis://localhost:6379',
  JWT_STUDENT_SECRET: 's'.repeat(32),
  JWT_STAFF_SECRET: 't'.repeat(32),
};

describe('parseAppConfig', () => {
  it('applies defaults to a minimal valid environment', () => {
    const config = parseAppConfig(VALID_ENV);
    expect(config.port).toBe(3000);
    expect(config.jwt.accessTtlSeconds).toBe(900);
  });

  it('names invalid fields without echoing their values', () => {
    const secret = 'too-short';
    expect(() => parseAppConfig({ ...VALID_ENV, JWT_STAFF_SECRET: secret })).toThrow(
      /JWT_STAFF_SECRET/,
    );
    try {
      parseAppConfig({ ...VALID_ENV, JWT_STAFF_SECRET: secret });
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
    }
  });
});
