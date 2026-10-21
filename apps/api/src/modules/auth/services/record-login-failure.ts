import { isLockedOut, type LoginLockState, recordFailedLogin } from '../domain/login-lockout';

/** Lockout state storage for an account type (students or staff). */
export interface LoginLockStore {
  readLockState(accountId: string): Promise<LoginLockState | null>;
  /** Writes `next` only while the stored state still equals `expected`; false otherwise. */
  replaceLockState(
    accountId: string,
    expected: LoginLockState,
    next: LoginLockState,
  ): Promise<boolean>;
}

const MAX_ATTEMPTS = 20;

/**
 * Records one failed sign-in (BR-AUTH-3). Parallel failures must each count, otherwise a burst
 * of guesses never reaches the lockout, so the write is a compare-and-swap retried on conflict.
 * Returns the state after this failure; it may already be locked by a parallel attempt.
 */
export async function recordLoginFailure(
  store: LoginLockStore,
  accountId: string,
  current: LoginLockState,
  now: Date,
): Promise<LoginLockState> {
  let state = current;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (isLockedOut(state, now)) return state;
    const next = recordFailedLogin(state, now);
    if (await store.replaceLockState(accountId, state, next)) return next;
    const fresh = await store.readLockState(accountId);
    if (!fresh) return next;
    state = fresh;
  }
  throw new Error('Could not record the failed sign-in under contention');
}
