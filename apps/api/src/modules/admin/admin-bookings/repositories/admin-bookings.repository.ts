import { Injectable } from '@nestjs/common';
import { type AdminBooking, type adminBookingListQuerySchema, type Paginated } from '@ennel/shared';
import { type z } from 'zod';
import { type Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../../infrastructure/database/transaction-runner';

type ListQuery = z.output<typeof adminBookingListQuerySchema>;

const ROW_INCLUDE = {
  meal: { select: { mealType: true } },
  slot: { select: { label: true, startMinute: true } },
  student: {
    select: {
      fullName: true,
      rosterEntry: { select: { referenceNumber: true } },
      hostelBlock: { select: { name: true, hostel: { select: { name: true } } } },
    },
  },
} as const;

type Row = Prisma.BookingGetPayload<{ include: typeof ROW_INCLUDE }>;

/** Admin §H grid reads. Writes go through BookingCommandsService (ADR-0003). */
@Injectable()
export class AdminBookingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListQuery): Promise<Paginated<AdminBooking>> {
    const where = toWhere(query);
    const [rows, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: ROW_INCLUDE,
        orderBy: orderBy(query),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { items: rows.map(toAdminBooking), total, page: query.page, pageSize: query.pageSize };
  }

  async findMany(ids: string[], tx: TransactionClient = this.prisma): Promise<AdminBooking[]> {
    const rows = await tx.booking.findMany({ where: { id: { in: ids } }, include: ROW_INCLUDE });
    return rows.map(toAdminBooking);
  }

  async findOne(id: string, tx: TransactionClient = this.prisma): Promise<AdminBooking | null> {
    const row = await tx.booking.findUnique({ where: { id }, include: ROW_INCLUDE });
    return row ? toAdminBooking(row) : null;
  }

  async studentExists(studentId: string, tx: TransactionClient): Promise<boolean> {
    return (
      (await tx.student.count({ where: { id: studentId, status: { not: 'DEACTIVATED' } } })) > 0
    );
  }
}

function toWhere(query: ListQuery): Prisma.BookingWhereInput {
  const search = query.q?.trim();
  return {
    mealDate: new Date(`${query.date}T00:00:00Z`),
    ...(query.mealType && { meal: { mealType: query.mealType } }),
    ...(query.slotId && { slotId: query.slotId }),
    ...(query.status && { status: query.status }),
    ...(query.source && { source: query.source }),
    ...(query.hostelId && { student: { hostelBlock: { hostelId: query.hostelId } } }),
    ...(search && {
      OR: [
        { student: { fullName: { contains: search, mode: 'insensitive' } } },
        {
          student: {
            rosterEntry: { referenceNumber: { contains: search.replace(/\D/g, '') || search } },
          },
        },
      ],
    }),
  };
}

/** Sortable columns of the grid; unknown keys fall back to slot time (Admin UX standards). */
function orderBy(query: ListQuery): Prisma.BookingOrderByWithRelationInput[] {
  const direction = query.sortOrder;
  switch (query.sortBy) {
    case 'student':
      return [{ student: { fullName: direction } }, { id: 'asc' }];
    case 'status':
      return [{ status: direction }, { id: 'asc' }];
    case 'updatedAt':
      return [{ updatedAt: direction }, { id: 'asc' }];
    default:
      return [
        { slot: { startMinute: direction } },
        { student: { fullName: 'asc' } },
        { id: 'asc' },
      ];
  }
}

function toAdminBooking(row: Row): AdminBooking {
  return {
    id: row.id,
    studentId: row.studentId,
    studentName: row.student.fullName,
    referenceNumber: row.student.rosterEntry.referenceNumber,
    hostelName: row.student.hostelBlock?.hostel.name ?? null,
    blockName: row.student.hostelBlock?.name ?? null,
    date: row.mealDate.toISOString().slice(0, 10),
    mealType: row.meal.mealType,
    slotId: row.slotId,
    slotLabel: row.slot.label,
    dietType: row.dietType,
    status: row.status,
    source: row.source,
    isOverCapacity: row.isOverCapacity,
    isUpdatedByStaff: row.lastActorType === 'STAFF',
    lastOverrideReason: row.lastOverrideReason,
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}
