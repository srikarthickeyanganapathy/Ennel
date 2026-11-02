import { Injectable } from '@nestjs/common';
import {
  type AdminNoShowEvent,
  type adminNoShowListQuerySchema,
  type BusinessDate,
  type MealType,
} from '@ennel/shared';
import { type z } from 'zod';
import { type Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../../infrastructure/database/transaction-runner';

type ListQuery = z.output<typeof adminNoShowListQuerySchema>;
const toDbDate = (date: BusinessDate) => new Date(`${date}T00:00:00Z`);

const EVENT_INCLUDE = {
  student: {
    select: {
      id: true,
      fullName: true,
      rosterEntry: { select: { referenceNumber: true } },
      hostelBlock: { select: { name: true } },
    },
  },
  excludedBy: { select: { fullName: true } },
  appeals: {
    select: {
      id: true,
      status: true,
      message: true,
      decisionReason: true,
      createdAt: true,
      decidedAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
} as const;
type EventRow = Prisma.NoShowEventGetPayload<{ include: typeof EVENT_INCLUDE }>;

/** Staff view of No-show events and appeals (Admin §J). */
@Injectable()
export class AdminNoShowsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ListQuery,
    windowFrom: BusinessDate,
  ): Promise<{ items: AdminNoShowEvent[]; total: number }> {
    const where = buildWhere(query);
    const [rows, total] = await Promise.all([
      this.prisma.noShowEvent.findMany({
        where,
        include: EVENT_INCLUDE,
        // Queues read oldest first; the full list shows the latest meals first.
        orderBy:
          query.appeal || query.status === 'HELD_FOR_REVIEW'
            ? [{ createdAt: 'asc' }]
            : [{ mealDate: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.noShowEvent.count({ where }),
    ]);
    const counts = await this.countsFor(rows, windowFrom);
    const disabled = await this.disabledFor(rows);
    return {
      items: rows.map((row) => toAdminEvent(row, counts, disabled)),
      total,
    };
  }

  queueSizes(): Promise<[number, number]> {
    return Promise.all([
      this.prisma.noShowAppeal.count({ where: { status: 'PENDING' } }),
      this.prisma.noShowEvent.count({ where: { status: 'HELD_FOR_REVIEW' } }),
    ]);
  }

  async findAppealEvent(appealId: string, tx: TransactionClient) {
    return tx.noShowAppeal.findUnique({
      where: { id: appealId },
      select: {
        id: true,
        status: true,
        event: {
          select: { id: true, studentId: true, mealType: true, status: true, mealDate: true },
        },
      },
    });
  }

  async studentExists(studentId: string): Promise<boolean> {
    return (await this.prisma.student.count({ where: { id: studentId } })) === 1;
  }

  /** Student and meal pairs with at least `minimum` counted events in the window. */
  async countedByStudentMeal(from: BusinessDate, minimum: number) {
    const groups = await this.prisma.noShowEvent.groupBy({
      by: ['studentId', 'mealType'],
      where: { status: 'COUNTED', mealDate: { gte: toDbDate(from) } },
      having: { studentId: { _count: { gte: minimum } } },
      _count: { _all: true },
    });
    return groups.map((group) => ({
      studentId: group.studentId,
      mealType: group.mealType as MealType,
      count: group._count._all,
    }));
  }

  async studentRefs(ids: string[]): Promise<Map<string, AdminNoShowEvent['student']>> {
    const rows = await this.prisma.student.findMany({
      where: { id: { in: ids } },
      select: EVENT_INCLUDE.student.select,
    });
    return new Map(rows.map((row) => [row.id, toStudentRef(row)]));
  }

  /** Counted events per student and meal in the window, keyed `studentId#MEAL`. */
  private async countsFor(rows: EventRow[], from: BusinessDate): Promise<Map<string, number>> {
    const studentIds = [...new Set(rows.map((row) => row.studentId))];
    if (studentIds.length === 0) return new Map();
    const groups = await this.prisma.noShowEvent.groupBy({
      by: ['studentId', 'mealType'],
      where: {
        studentId: { in: studentIds },
        status: 'COUNTED',
        mealDate: { gte: toDbDate(from) },
      },
      _count: { _all: true },
    });
    return new Map(
      groups.map((group) => [`${group.studentId}#${group.mealType}`, group._count._all]),
    );
  }

  private async disabledFor(rows: EventRow[]): Promise<Set<string>> {
    const studentIds = [...new Set(rows.map((row) => row.studentId))];
    if (studentIds.length === 0) return new Set();
    const prefs = await this.prisma.mealPreference.findMany({
      where: { studentId: { in: studentIds }, autoDisabledAt: { not: null } },
      select: { studentId: true, meal: { select: { mealType: true } } },
    });
    return new Set(prefs.map((pref) => `${pref.studentId}#${pref.meal.mealType}`));
  }
}

function buildWhere(query: ListQuery): Prisma.NoShowEventWhereInput {
  const search = query.q?.trim();
  return {
    ...(query.status && { status: query.status }),
    ...(query.appeal && { appeals: { some: { status: query.appeal } } }),
    ...(query.mealType && { mealType: query.mealType }),
    ...((query.from || query.to) && {
      mealDate: {
        ...(query.from && { gte: toDbDate(query.from) }),
        ...(query.to && { lte: toDbDate(query.to) }),
      },
    }),
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

function toStudentRef(row: EventRow['student']): AdminNoShowEvent['student'] {
  return {
    id: row.id,
    fullName: row.fullName,
    referenceNumber: row.rosterEntry.referenceNumber,
    blockName: row.hostelBlock?.name ?? null,
  };
}

function toAdminEvent(
  row: EventRow,
  counts: Map<string, number>,
  disabled: Set<string>,
): AdminNoShowEvent {
  const key = `${row.studentId}#${row.mealType as MealType}`;
  const appeal = row.appeals[0];
  return {
    id: row.id,
    date: row.mealDate.toISOString().slice(0, 10),
    mealType: row.mealType,
    status: row.status,
    exclusionCause: row.exclusionCause,
    excludedReason: row.excludedReason,
    excludedByName: row.excludedBy?.fullName ?? null,
    student: toStudentRef(row.student),
    currentCount: counts.get(key) ?? 0,
    isAutoDisabled: disabled.has(key),
    appeal: appeal
      ? {
          id: appeal.id,
          status: appeal.status,
          message: appeal.message,
          decisionReason: appeal.decisionReason,
          createdAt: appeal.createdAt.toISOString(),
          decidedAt: appeal.decidedAt?.toISOString() ?? null,
        }
      : null,
    createdAt: row.createdAt.toISOString(),
  };
}
