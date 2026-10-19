import { type PrismaService } from '../../../src/infrastructure/database/prisma.service';
import { seedMessConfig } from '../../../prisma/seed/mess-config.seed';

// audit_logs is append-only (trigger), so it is never truncated; tests assert on their own rows.
const PRESERVED_TABLES = new Set(['_prisma_migrations', 'audit_logs']);

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  const names = tables
    .map((table) => table.tablename)
    .filter((name) => !PRESERVED_TABLES.has(name))
    .map((name) => `"${name}"`);
  await prisma.$executeRawUnsafe(`TRUNCATE ${names.join(', ')} RESTART IDENTITY CASCADE`);
}

export interface Fixtures {
  blockId: string;
  referenceNumbers: string[];
}

export async function seedFixtures(prisma: PrismaService): Promise<Fixtures> {
  const quiet = console.log;
  console.log = () => undefined;
  try {
    await seedMessConfig(prisma);
  } finally {
    console.log = quiet;
  }
  const hostel = await prisma.hostel.create({
    data: { name: 'Test Hostel', blocks: { create: [{ name: 'Block A' }] } },
    include: { blocks: true },
  });
  const blockId = hostel.blocks[0]?.id;
  if (!blockId) throw new Error('fixture block missing');
  const referenceNumbers = ['24900001', '24900002', '24900003'];
  await prisma.collegeRosterEntry.createMany({
    data: referenceNumbers.map((referenceNumber, index) => ({
      referenceNumber,
      fullName: `Test Student ${index + 1}`,
      department: 'Computer Science',
      academicYear: 2,
      hostelBlockId: blockId,
      roomNumber: `10${index}`,
    })),
  });
  await prisma.collegeRosterEntry.create({
    data: {
      referenceNumber: '24900099',
      fullName: 'Inactive',
      department: 'X',
      academicYear: 1,
      isActive: false,
    },
  });
  return { blockId, referenceNumbers };
}
