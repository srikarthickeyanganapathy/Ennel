import { describe, expect, it } from 'vitest';
import { decideAccessChange, type StudentAccessState } from './student-access';

const registered = (
  status: 'ACTIVE' | 'LOCKED' | 'DEACTIVATED',
  isRosterActive = true,
): StudentAccessState => ({
  isRegistered: true,
  status,
  isRosterActive,
});
const unregistered = (isRosterActive = true): StudentAccessState => ({
  isRegistered: false,
  status: null,
  isRosterActive,
});

describe('decideAccessChange (Admin §G)', () => {
  it('locks an active account and ends its sessions', () => {
    expect(decideAccessChange(registered('ACTIVE'), 'LOCK')).toEqual({
      studentStatus: 'LOCKED',
      isRosterActive: true,
      shouldRevokeSessions: true,
    });
  });

  it('cannot lock an unregistered or already locked account', () => {
    expect(() => decideAccessChange(unregistered(), 'LOCK')).toThrow(/Only an active/);
    expect(() => decideAccessChange(registered('LOCKED'), 'LOCK')).toThrow();
  });

  it('unlocks only a locked account', () => {
    expect(decideAccessChange(registered('LOCKED'), 'UNLOCK').studentStatus).toBe('ACTIVE');
    expect(() => decideAccessChange(registered('ACTIVE'), 'UNLOCK')).toThrow(/not locked/);
  });

  it('deactivates registered and unregistered students, blocking registration too', () => {
    expect(decideAccessChange(registered('ACTIVE'), 'DEACTIVATE')).toEqual({
      studentStatus: 'DEACTIVATED',
      isRosterActive: false,
      shouldRevokeSessions: true,
    });
    expect(decideAccessChange(unregistered(), 'DEACTIVATE')).toEqual({
      studentStatus: null,
      isRosterActive: false,
      shouldRevokeSessions: false,
    });
    expect(() => decideAccessChange(unregistered(false), 'DEACTIVATE')).toThrow(/already/);
  });

  it('reactivates deactivated students', () => {
    expect(decideAccessChange(registered('DEACTIVATED', false), 'REACTIVATE')).toMatchObject({
      studentStatus: 'ACTIVE',
      isRosterActive: true,
    });
    expect(decideAccessChange(unregistered(false), 'REACTIVATE').isRosterActive).toBe(true);
    expect(() => decideAccessChange(registered('ACTIVE'), 'REACTIVATE')).toThrow(/not deactivated/);
  });
});
