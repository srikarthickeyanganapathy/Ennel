import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { seedDevRoster } from './dev-roster.seed';
import { seedMeals, seedSampleSlots } from './mess-config.seed';
import { seedPolicy } from './policy.seed';
import { seedRbac } from './rbac.seed';
import { seedSuperAdmin } from './super-admin.seed';

// Idempotent: safe to run repeatedly; it never overwrites data staff have edited.
// `--dev` (pnpm db:seed:dev) adds sample slots and a fictitious roster for local development.
const isDevSeed = process.argv.includes('--dev');

async function main(): Promise<void> {
  const rootEnvFile = resolve(__dirname, '../../../../.env');
  if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await seedRbac(prisma);
    await seedPolicy(prisma);
    await seedMeals(prisma);
    await seedSuperAdmin(prisma, process.env);
    if (isDevSeed) {
      await seedSampleSlots(prisma);
      await seedDevRoster(prisma);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
