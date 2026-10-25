import { Injectable } from '@nestjs/common';
import { type adminLeaveListQuerySchema, type BusinessDate } from '@ennel/shared';
import { type z } from 'zod';
import { type Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../../infrastructure/database/transaction-runner';
import { type LeaveRow, toLeaveRow } from '../../../leaves/repositories/leaves.repository';

type ListQuery = z.output<typeof adminLeaveListQuerySchema>;
const toDbDate = (date: BusinessDate) => new Date(`${date}T00:00:00Z`);

const LEAVE_INCLUDE = {
  student: {
    select: {
      id: true,
      fullName: true,
      rosterEntry: { select: { referenceNumber: true } },
      hostelBlock: { select: { name: true } },
    },
  },
  decidedBy: { select: { fullName: true } },
} as const;
type LeaveWithStudent = Prisma.LeaveGetPayload<{ include: typeof LEAVE_INCLUDE }>;

export interface AdminLeaveRow extends LeaveRow {
  student: { id: string; fullName: string; referenceNumber: string; blockName: string | null };
  decidedByName: string | null;
}

/** Staff view of all leaves (Admin §K). */
@Injectable()
export class AdminLeavesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ListQuery,
    today: BusinessDate,
  ): Promise<{ rows: AdminLeaveRow[]; total: number }> {
    const where = buildWhere(query, today);
    const [rows, total] = await Promise.all([
      this.prisma.leave.findMany({
        where,
        include: LEAVE_INCLUDE,
        // The approval queue reads oldest-first by start; the full list shows recent first.
        orderBy:
          query.status === 'PENDING'
            ? [{ startDate: 'asc' }]
            : [{ startDate: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.leave.count({ where }),
    ]);
    return { rows: rows.map(toAdminRow), total };
  }

  countPending(): Promise<number> {
    return this.prisma.leave.count({ where: { status: 'PENDING' } });
  }

  async find(id: string, tx: TransactionClient = this.prisma): Promise<AdminLeaveRow | null> {
    const row = await tx.leave.findUnique({ where: { id }, include: LEAVE_INCLUDE });
    return row ? toAdminRow(row) : null;
  }

  async studentExists(studentId: string): Promise<boolean> {
    return (await this.prisma.student.count({ where: { id: studentId } })) === 1;
  }
}

/**
 * Derived states are filtered by date (Upcoming: starts after today, On Leave: covers today,
 * Ended: ended before today); the exact meal-level state is computed per row afterwards.
 */
function buildWhere(query: ListQuery, today: BusinessDate): Prisma.LeaveWhereInput {
  const day = toDbDate(today);
  const states: Record<string, Prisma.LeaveWhereInput> = {
    PENDING: { status: 'PENDING' },
    REJECTED: { status: 'REJECTED' },
    CANCELLED: { status: 'CANCELLED' },
    UPCOMING: { status: 'APPROVED', startDate: { gt: day } },
    ON_LEAVE: { status: 'APPROVED', startDate: { lte: day }, endDate: { gte: day } },
    ENDED: { status: 'APPROVED', endDate: { lt: day } },
  };
  const search = query.q?.trim();
  return {
    ...(query.status && { status: query.status }),
    ...(query.state && states[query.state]),
    ...(query.from && { endDate: { gte: toDbDate(query.from) } }),
    ...(query.to && { startDate: { lte: toDbDate(query.to) } }),
    ...(query.hostelBlockId && { student: { hostelBlockId: query.hostelBlockId } }),
    ...(search && {
      OR: [
        { student: { fullName: { contains: search, mode: 'insensitive' } } },
        {
          student: { rosterEntry: { referenceNumber: { contains: search.replace(/[\s-]/g, '') } } },
        },
      ],
    }),
  };
}

function toAdminRow(row: LeaveWithStudent): AdminLeaveRow {
  return {
    ...toLeaveRow(row),
    student: {
      id: row.student.id,
      fullName: row.student.fullName,
      referenceNumber: row.student.rosterEntry.referenceNumber,
      blockName: row.student.hostelBlock?.name ?? null,
    },
    decidedByName: row.decidedBy?.fullName ?? null,
  };
}
