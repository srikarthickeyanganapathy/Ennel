/**
 * Refresh-token rotation decision (ADR-0015, Rule 11). A token that was already rotated
 * (has a successor) or revoked is treated as stolen, so the whole session family is revoked.
 */
export interface RefreshSessionState {
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
}

export type RefreshDecision = 'ROTATE' | 'EXPIRED' | 'REUSE_DETECTED';

export function decideRefresh(session: RefreshSessionState, now: Date): RefreshDecision {
  if (session.replacedById !== null || session.revokedAt !== null) return 'REUSE_DETECTED';
  if (session.expiresAt.getTime() <= now.getTime()) return 'EXPIRED';
  return 'ROTATE';
}

export function calculateRefreshExpiry(now: Date, ttlDays: number): Date {
  return new Date(now.getTime() + ttlDays * 24 * 60 * 60_000);
}
