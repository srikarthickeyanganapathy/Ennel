/**
 * Account lockout after repeated failed logins (BR-AUTH-3, Rule 11). Shared by students and
 * staff: 5 consecutive failures lock the account for 15 minutes.
 */
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;

export interface LoginLockState {
  failedLoginCount: number;
  lockedUntil: Date | null;
}

export function isLockedOut(state: LoginLockState, now: Date): boolean {
  return state.lockedUntil !== null && state.lockedUntil.getTime() > now.getTime();
}

/** State after a wrong password. An expired lock starts a fresh count. */
export function recordFailedLogin(state: LoginLockState, now: Date): LoginLockState {
  const hasExpiredLock = state.lockedUntil !== null && !isLockedOut(state, now);
  const failedLoginCount = (hasExpiredLock ? 0 : state.failedLoginCount) + 1;
  if (failedLoginCount < MAX_FAILED_LOGINS) return { failedLoginCount, lockedUntil: null };
  return {
    failedLoginCount,
    lockedUntil: new Date(now.getTime() + LOCKOUT_MINUTES * 60_000),
  };
}

export function recordSuccessfulLogin(): LoginLockState {
  return { failedLoginCount: 0, lockedUntil: null };
}
