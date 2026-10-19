import { describe, expect, it } from 'vitest';
import { StaffRole } from '../enums/staff.js';
import { DEFAULT_ROLE_PERMISSIONS } from './default-role-permissions.js';
import { PERMISSION_KEYS, isPermissionKey } from './permission-keys.js';

describe('permissions (Admin §A)', () => {
  it('uses resource:action keys without duplicates', () => {
    expect(new Set(PERMISSION_KEYS).size).toBe(PERMISSION_KEYS.length);
    for (const key of PERMISSION_KEYS) expect(key).toMatch(/^[a-z-]+:[a-z-]+$/);
  });

  it('gives Super Admin every permission', () => {
    expect([...DEFAULT_ROLE_PERMISSIONS[StaffRole.SUPER_ADMIN]].sort()).toEqual(
      [...PERMISSION_KEYS].sort(),
    );
  });

  it('defines every default role with valid, unique keys', () => {
    for (const role of Object.values(StaffRole)) {
      const keys = DEFAULT_ROLE_PERMISSIONS[role];
      expect(new Set(keys).size).toBe(keys.length);
      for (const key of keys) expect(isPermissionKey(key)).toBe(true);
    }
  });

  it('keeps policy, staff, roles and audit log away from operational roles', () => {
    const restricted = ['policy:update', 'staff:manage', 'roles:manage', 'audit-log:read'];
    for (const role of [StaffRole.MESS_MANAGER, StaffRole.MESS_STAFF, StaffRole.WARDEN]) {
      for (const key of restricted) expect(DEFAULT_ROLE_PERMISSIONS[role]).not.toContain(key);
    }
  });

  it('keeps the Auditor read-only', () => {
    const writes = DEFAULT_ROLE_PERMISSIONS[StaffRole.AUDITOR].filter(
      (key) => !/:(read|export)$/.test(key),
    );
    expect(writes).toEqual([]);
  });
});
