import { hash } from 'argon2';
import { StaffRole } from '@ennel/shared';
import { type PrismaClient } from '../../src/generated/prisma/client';

const MIN_STAFF_PASSWORD_LENGTH = 12; // BR-AUTH-3

/**
 * Creates the first Super Admin from .env, the only way one is ever created (Admin §B).
 * Skipped once any staff account exists. The password must be changed on first login.
 */
export async function seedSuperAdmin(prisma: PrismaClient, env: NodeJS.ProcessEnv): Promise<void> {
  if ((await prisma.staffUser.count()) > 0) {
    console.log('Super Admin: staff already exist, skipped');
    return;
  }
  const email = env.SEED_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const fullName = env.SEED_SUPER_ADMIN_NAME?.trim() || 'ENNEL Super Admin';
  const password = env.SEED_SUPER_ADMIN_PASSWORD ?? '';
  if (!email) throw new Error('SEED_SUPER_ADMIN_EMAIL is not set');
  if (password.length < MIN_STAFF_PASSWORD_LENGTH || password.toLowerCase() === email) {
    throw new Error(
      `SEED_SUPER_ADMIN_PASSWORD must be at least ${MIN_STAFF_PASSWORD_LENGTH} characters and differ from the email`,
    );
  }

  const role = await prisma.role.findUniqueOrThrow({ where: { key: StaffRole.SUPER_ADMIN } });
  await prisma.staffUser.create({
    data: {
      email,
      fullName,
      passwordHash: await hash(password),
      mustChangePassword: true,
      roles: { create: { roleId: role.id } },
    },
  });
  console.log('Super Admin: created (password change required on first login)');
}
