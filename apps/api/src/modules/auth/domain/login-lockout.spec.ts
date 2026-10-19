import { describe, expect, it } from 'vitest';
import {
  LOCKOUT_MINUTES,
  MAX_FAILED_LOGINS,
  isLockedOut,
  recordFailedLogin,
  recordSuccessfulLogin,
} from './login-lockout';

const NOW = new Date('2026-10-19T05:30:00.000Z');
const minutesLater = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

describe('login lockout (BR-AUTH-3)', () => {
  it('counts failures without locking below the threshold', () => {
    const state = recordFailedLogin(
      { failedLoginCount: MAX_FAILED_LOGINS - 2, lockedUntil: null },
      NOW,
    );
    expect(state).toEqual({ failedLoginCount: MAX_FAILED_LOGINS - 1, lockedUntil: null });
  });

  it('locks for 15 minutes on the fifth consecutive failure', () => {
    const state = recordFailedLogin(
      { failedLoginCount: MAX_FAILED_LOGINS - 1, lockedUntil: null },
      NOW,
    );
    expect(state.lockedUntil).toEqual(minutesLater(LOCKOUT_MINUTES));
    expect(isLockedOut(state, NOW)).toBe(true);
  });

  it('unlocks exactly when the lock expires', () => {
    const state = { failedLoginCount: 5, lockedUntil: minutesLater(LOCKOUT_MINUTES) };
    expect(isLockedOut(state, minutesLater(LOCKOUT_MINUTES - 1))).toBe(true);
    expect(isLockedOut(state, minutesLater(LOCKOUT_MINUTES))).toBe(false);
  });

  it('starts a fresh count after an expired lock', () => {
    const expired = { failedLoginCount: 5, lockedUntil: minutesLater(-1) };
    expect(recordFailedLogin(expired, NOW)).toEqual({ failedLoginCount: 1, lockedUntil: null });
  });

  it('resets on success', () => {
    expect(recordSuccessfulLogin()).toEqual({ failedLoginCount: 0, lockedUntil: null });
  });
});
