import { type PrismaClient } from '../../src/generated/prisma/client';

/** Creates the singleton policy row with schema defaults (ADR-0005..0013); never overwrites. */
export async function seedPolicy(prisma: PrismaClient): Promise<void> {
  await prisma.messPolicy.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  console.log('Policy: singleton row present');
}
