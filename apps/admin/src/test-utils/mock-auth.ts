import { type PermissionKey, type StaffMe } from '@ennel/shared';
import { vi } from 'vitest';

/** Replaces useAuth/usePermissions for component tests. Call before rendering. */
export function mockAuth(permissions: PermissionKey[], overrides: Partial<StaffMe> = {}) {
  const me: StaffMe = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'warden@ennel.test',
    fullName: 'Test Warden',
    roles: ['WARDEN'],
    permissions,
    mustChangePassword: false,
    totpEnabled: false,
    ...overrides,
  };
  const granted = new Set(permissions);
  return {
    status: 'signedIn' as const,
    me,
    permissions: granted,
    startSession: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
    reloadMe: vi.fn(async () => undefined),
  };
}
