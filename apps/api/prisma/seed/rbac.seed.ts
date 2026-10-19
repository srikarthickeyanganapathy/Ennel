import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  PERMISSION_KEYS,
  StaffRole,
} from '@ennel/shared';
import { type PrismaClient } from '../../src/generated/prisma/client';

const ROLE_NAMES: Record<StaffRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  MESS_MANAGER: 'Mess Manager',
  MESS_STAFF: 'Mess Staff',
  WARDEN: 'Warden',
  AUDITOR: 'Auditor',
};

/**
 * Syncs permission keys from @ennel/shared. Default role permissions are applied only when a
 * role is first created, so later edits by a Super Admin survive re-seeding. Super Admin always
 * receives every key, including newly added ones (Admin §A).
 */
export async function seedRbac(prisma: PrismaClient): Promise<void> {
  for (const key of PERMISSION_KEYS) {
    const description = PERMISSION_DESCRIPTIONS[key];
    await prisma.permission.upsert({
      where: { key },
      create: { key, description },
      update: { description },
    });
  }

  for (const roleKey of Object.values(StaffRole)) {
    const existing = await prisma.role.findUnique({ where: { key: roleKey } });
    const role =
      existing ?? (await prisma.role.create({ data: { key: roleKey, name: ROLE_NAMES[roleKey] } }));
    const shouldApplyDefaults = !existing || roleKey === StaffRole.SUPER_ADMIN;
    if (!shouldApplyDefaults) continue;
    await prisma.rolePermission.createMany({
      data: DEFAULT_ROLE_PERMISSIONS[roleKey].map((permissionKey) => ({
        roleId: role.id,
        permissionKey,
      })),
      skipDuplicates: true,
    });
  }
  console.log(
    `RBAC: ${PERMISSION_KEYS.length} permissions, ${Object.values(StaffRole).length} roles`,
  );
}
