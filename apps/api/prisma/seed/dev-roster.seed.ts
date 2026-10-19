import { type PrismaClient } from '../../src/generated/prisma/client';

// Fictitious development data only; real rosters arrive through the admin import (Admin §G).
const DEV_HOSTEL = { name: 'Dev Hostel', blocks: ['Block A', 'Block B'] };

const DEV_ROSTER = [
  {
    referenceNumber: '24900001',
    fullName: 'Dev Student One',
    department: 'Computer Science',
    academicYear: 1,
    block: 'Block A',
    room: '101',
  },
  {
    referenceNumber: '24900002',
    fullName: 'Dev Student Two',
    department: 'Mechanical',
    academicYear: 2,
    block: 'Block A',
    room: '102',
  },
  {
    referenceNumber: '24900003',
    fullName: 'Dev Student Three',
    department: 'Civil',
    academicYear: 3,
    block: 'Block B',
    room: '201',
  },
  {
    referenceNumber: '24900004',
    fullName: 'Dev Student Four',
    department: 'Electronics',
    academicYear: 4,
    block: 'Block B',
    room: '202',
  },
];

export async function seedDevRoster(prisma: PrismaClient): Promise<void> {
  const hostel = await prisma.hostel.upsert({
    where: { name: DEV_HOSTEL.name },
    create: { name: DEV_HOSTEL.name },
    update: {},
  });
  const blockIds = new Map<string, string>();
  for (const name of DEV_HOSTEL.blocks) {
    const block = await prisma.hostelBlock.upsert({
      where: { hostelId_name: { hostelId: hostel.id, name } },
      create: { hostelId: hostel.id, name },
      update: {},
    });
    blockIds.set(name, block.id);
  }
  for (const { block, room, ...fields } of DEV_ROSTER) {
    await prisma.collegeRosterEntry.upsert({
      where: { referenceNumber: fields.referenceNumber },
      create: { ...fields, roomNumber: room, hostelBlockId: blockIds.get(block) ?? null },
      update: {},
    });
  }
  console.log(`Dev roster: ${DEV_ROSTER.length} entries`);
}
