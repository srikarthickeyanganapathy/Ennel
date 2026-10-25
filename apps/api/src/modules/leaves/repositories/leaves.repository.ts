import { Injectable } from '@nestjs/common';
import { type BusinessDate, type LeaveStatus, type MealRange, type MealType } from '@ennel/shared';
import { type Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';

const toDbDate = (date: BusinessDate) => new Date(`${date}T00:00:00Z`);
const fromDbDate = (date: Date): BusinessDate => date.toISOString().slice(0, 10);

export interface LeaveRow {
  id: string;
  studentId: string;
  range: MealRange;
  reason: string | null;
  status: LeaveStatus;
  rejectionReason: string | null;
  isCreatedByStaff: boolean;
  createdAt: Date;
  decidedAt: Date | null;
  version: number;
}

export interface LeaveWrite {
  range?: MealRange;
  status?: LeaveStatus;
  reason?: string | null;
  rejectionReason?: string | null;
  decidedById?: string | null;
  decidedAt?: Date | null;
}

export interface LeaveChangeWrite {
  leaveId: string;
  kind: 'EXTENDED' | 'ENDED_EARLY' | 'CORRECTED';
  before: MealRange;
  after: MealRange & { status?: LeaveStatus };
  actorType: 'STUDENT' | 'STAFF';
  actorStaffId: string | null;
  reason: string | null;
}

type DbLeave = Prisma.LeaveGetPayload<object>;

/** Leaves and their change history (Spec §11, Admin §K). */
@Injectable()
export class LeavesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Leave changes for one student are serialised so the overlap check cannot be raced. */
  async lockStudent(studentId: string, tx: TransactionClient): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`leaves:${studentId}`}, 0))`;
  }

  async listForStudent(
    studentId: string,
    tx: TransactionClient = this.prisma,
  ): Promise<LeaveRow[]> {
    const rows = await tx.leave.findMany({
      where: { studentId },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(toLeaveRow);
  }

  async find(id: string, tx: TransactionClient = this.prisma): Promise<LeaveRow | null> {
    const row = await tx.leave.findUnique({ where: { id } });
    return row ? toLeaveRow(row) : null;
  }

  async create(
    data: {
      studentId: string;
      range: MealRange;
      reason: string | null;
      status: LeaveStatus;
      createdByStaffId: string | null;
      decidedById: string | null;
      decidedAt: Date | null;
    },
    tx: TransactionClient,
  ): Promise<string> {
    const row = await tx.leave.create({
      data: {
        studentId: data.studentId,
        ...toDbRange(data.range),
        reason: data.reason,
        status: data.status,
        createdByStaffId: data.createdByStaffId,
        decidedById: data.decidedById,
        decidedAt: data.decidedAt,
      },
      select: { id: true },
    });
    return row.id;
  }

  /** Returns false when the version no longer matches (changed elsewhere). */
  async update(
    id: string,
    version: number,
    write: LeaveWrite,
    tx: TransactionClient,
  ): Promise<boolean> {
    const { range, ...rest } = write;
    const result = await tx.leave.updateMany({
      where: { id, version },
      data: { ...rest, ...(range && toDbRange(range)), version: { increment: 1 } },
    });
    return result.count === 1;
  }

  async addChange(change: LeaveChangeWrite, tx: TransactionClient): Promise<void> {
    await tx.leaveChange.create({
      data: {
        leaveId: change.leaveId,
        kind: change.kind,
        before: { ...change.before },
        after: { ...change.after },
        actorType: change.actorType,
        actorStaffId: change.actorStaffId,
        reason: change.reason,
      },
    });
  }

  /** Slot start of each Booked meal between two dates, keyed `date#MEAL` (cut-offs, preview). */
  async bookedSlotStarts(
    studentId: string,
    from: BusinessDate,
    to: BusinessDate,
    tx: TransactionClient = this.prisma,
  ): Promise<Map<string, number>> {
    const rows = await tx.booking.findMany({
      where: {
        studentId,
        status: 'BOOKED',
        mealDate: { gte: toDbDate(from), lte: toDbDate(to) },
      },
      select: {
        mealDate: true,
        meal: { select: { mealType: true } },
        slot: { select: { startMinute: true } },
      },
    });
    return new Map(
      rows.map((row) => [
        mealKey(fromDbDate(row.mealDate), row.meal.mealType),
        row.slot.startMinute,
      ]),
    );
  }
}

export const mealKey = (date: BusinessDate, mealType: MealType) => `${date}#${mealType}`;

function toDbRange(range: MealRange) {
  return {
    startDate: toDbDate(range.startDate),
    startMealType: range.startMealType,
    endDate: toDbDate(range.endDate),
    endMealType: range.endMealType,
  };
}

export function toLeaveRow(row: DbLeave): LeaveRow {
  return {
    id: row.id,
    studentId: row.studentId,
    range: {
      startDate: fromDbDate(row.startDate),
      startMealType: row.startMealType,
      endDate: fromDbDate(row.endDate),
      endMealType: row.endMealType,
    },
    reason: row.reason,
    status: row.status,
    rejectionReason: row.rejectionReason,
    isCreatedByStaff: row.createdByStaffId !== null,
    createdAt: row.createdAt,
    decidedAt: row.decidedAt,
    version: row.version,
  };
}
