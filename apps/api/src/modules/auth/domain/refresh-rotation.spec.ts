import { describe, expect, it } from 'vitest';
import { calculateRefreshExpiry, decideRefresh } from './refresh-rotation';

const NOW = new Date('2026-10-19T05:30:00.000Z');
const FUTURE = new Date('2026-11-18T05:30:00.000Z');

describe('decideRefresh (ADR-0015)', () => {
  it('rotates a live, unused token', () => {
    expect(decideRefresh({ expiresAt: FUTURE, revokedAt: null, replacedById: null }, NOW)).toBe(
      'ROTATE',
    );
  });

  it('treats an already-rotated token as reuse', () => {
    expect(decideRefresh({ expiresAt: FUTURE, revokedAt: null, replacedById: 'next' }, NOW)).toBe(
      'REUSE_DETECTED',
    );
  });

  it('treats a revoked token as reuse', () => {
    expect(decideRefresh({ expiresAt: FUTURE, revokedAt: NOW, replacedById: null }, NOW)).toBe(
      'REUSE_DETECTED',
    );
  });

  it('expires exactly at the expiry instant', () => {
    expect(decideRefresh({ expiresAt: NOW, revokedAt: null, replacedById: null }, NOW)).toBe(
      'EXPIRED',
    );
  });
});

describe('calculateRefreshExpiry', () => {
  it('adds whole days', () => {
    expect(calculateRefreshExpiry(NOW, 30)).toEqual(FUTURE);
  });
});
