import { describe, expect, it } from 'vitest';
import { type LoginLockState } from '../domain/login-lockout';
import { type LoginLockStore, recordLoginFailure } from './record-login-failure';

const now = new Date('2026-10-21T04:30:00.000Z');

/** In-memory store with compare-and-swap semantics, as the repositories implement it. */
class MemoryStore implements LoginLockStore {
  constructor(public state: LoginLockState) {}

  async readLockState(): Promise<LoginLockState> {
    return this.state;
  }

  async replaceLockState(
    _id: string,
    expected: LoginLockState,
    next: LoginLockState,
  ): Promise<boolean> {
    const isSame =
      expected.failedLoginCount === this.state.failedLoginCount &&
      expected.lockedUntil?.getTime() === this.state.lockedUntil?.getTime();
    if (isSame) this.state = next;
    return isSame;
  }
}

describe('recordLoginFailure (BR-AUTH-3)', () => {
  it('counts failures that were read from the same stale state', async () => {
    const store = new MemoryStore({ failedLoginCount: 0, lockedUntil: null });
    const stale = { failedLoginCount: 0, lockedUntil: null };
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await recordLoginFailure(store, 'id', stale, now);
    }
    expect(store.state.failedLoginCount).toBe(5);
    expect(store.state.lockedUntil).not.toBeNull();
  });

  it('stops once a parallel attempt has locked the account', async () => {
    const lockedUntil = new Date(now.getTime() + 60_000);
    const store = new MemoryStore({ failedLoginCount: 5, lockedUntil });
    const result = await recordLoginFailure(
      store,
      'id',
      { failedLoginCount: 4, lockedUntil: null },
      now,
    );
    expect(result).toEqual({ failedLoginCount: 5, lockedUntil });
  });
});
