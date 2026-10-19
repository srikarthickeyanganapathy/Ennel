import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { seedDevRoster } from './dev-roster.seed';
import { seedMessConfig } from './mess-config.seed';
import { seedPolicy } from './policy.seed';
import { seedRbac } from './rbac.seed';
import { seedSuperAdmin } from './super-admin.seed';

// Idempotent: safe to run repeatedly; it never overwrites data staff have edited.
async function main(): Promise<void> {
  const rootEnvFile = resolve(__dirname, '../../../../.env');
  if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await seedRbac(prisma);
    await seedPolicy(prisma);
    await seedMessConfig(prisma);
    if (process.env.NODE_ENV === 'development') await seedDevRoster(prisma);
    await seedSuperAdmin(prisma, process.env);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
