import { ErrorCode } from '@ennel/shared';
import { describe, expect, it } from 'vitest';
import { assertCanRegister, resolveRosterStatus } from './registration';

describe('roster check (Spec §3 Screen 2)', () => {
  it('returns NEW for an active, unregistered roster entry', () => {
    expect(resolveRosterStatus({ isActive: true, hasStudentAccount: false })).toBe('NEW');
  });

  it('returns REGISTERED when an account exists', () => {
    expect(resolveRosterStatus({ isActive: true, hasStudentAccount: true })).toBe('REGISTERED');
  });

  it.each([null, { isActive: false, hasStudentAccount: false }])(
    'rejects unknown or inactive numbers with ROSTER_NOT_FOUND',
    (roster) => {
      expect(() => resolveRosterStatus(roster)).toThrow(
        expect.objectContaining({ code: ErrorCode.ROSTER_NOT_FOUND }),
      );
    },
  );

  it('blocks a second registration with ALREADY_REGISTERED', () => {
    expect(() => assertCanRegister({ isActive: true, hasStudentAccount: true })).toThrow(
      expect.objectContaining({ code: ErrorCode.ALREADY_REGISTERED }),
    );
  });
});
