import { ErrorCode } from '@ennel/shared';
import { describe, expect, it } from 'vitest';
import { assertNotSelf, assertSuperAdminRemains, isSuperAdmin } from './staff-account-rules';
import { generateTemporaryPassword } from '../services/temporary-password';
import { findStaffPasswordProblem } from '../../admin-auth/domain/staff-password-policy';

describe('staff account rules', () => {
  it('refuses a change that leaves no active Super Admin', () => {
    expect(() => assertSuperAdminRemains(0)).toThrow(
      expect.objectContaining({ code: ErrorCode.VALIDATION_FAILED }),
    );
    expect(() => assertSuperAdminRemains(1)).not.toThrow();
  });

  it('refuses self-disable', () => {
    expect(() => assertNotSelf('a', 'a', 'disable')).toThrow(/cannot disable your own account/);
    expect(() => assertNotSelf('a', 'b', 'disable')).not.toThrow();
  });

  it('detects the Super Admin role', () => {
    expect(isSuperAdmin(['WARDEN', 'SUPER_ADMIN'])).toBe(true);
    expect(isSuperAdmin(['WARDEN'])).toBe(false);
  });

  it('generates temporary passwords that satisfy the staff policy', () => {
    const password = generateTemporaryPassword();
    expect(password).toHaveLength(24);
    expect(findStaffPasswordProblem(password, 'someone@ennel.local')).toBeNull();
    expect(generateTemporaryPassword()).not.toBe(password);
  });
});

describe('findStaffPasswordProblem (BR-AUTH-3)', () => {
  it('requires 12 characters and rejects the email or its name part', () => {
    expect(findStaffPasswordProblem('short-pass', 'a@b.c')).toMatch(/12 characters/);
    expect(
      findStaffPasswordProblem('warden.office@ennel.local', 'warden.office@ennel.local'),
    ).toMatch(/email address/);
    expect(findStaffPasswordProblem('wardenoffice', 'wardenoffice@ennel.local')).toMatch(
      /email name/,
    );
    expect(findStaffPasswordProblem('a-long-passphrase', 'wardenoffice@ennel.local')).toBeNull();
  });
});
