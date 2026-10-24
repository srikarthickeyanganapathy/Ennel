import { Injectable } from '@nestjs/common';
import {
  type AdminClosure,
  type BusinessDate,
  type ClosureKind,
  type MealType,
} from '@ennel/shared';
import { type Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../../infrastructure/database/transaction-runner';

const toDbDate = (date: BusinessDate) => new Date(`${date}T00:00:00Z`);
const MEAL_ORDER: Record<MealType, number> = { BREAKFAST: 0, LUNCH: 1, DINNER: 2 };

const CLOSURE_INCLUDE = {
  meals: { select: { meal: { select: { mealType: true } } } },
  createdBy: { select: { fullName: true } },
  removedBy: { select: { fullName: true } },
} as const;
type ClosureRow = Prisma.MessClosureGetPayload<{ include: typeof CLOSURE_INCLUDE }>;

export interface AffectedBooking {
  id: string;
  studentId: string;
  mealId: string;
  mealType: MealType;
  version: number;
}

/** Closures and the bookings they touch (Admin §F). */
@Injectable()
export class AdminClosuresRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    from: BusinessDate,
    to: BusinessDate | undefined,
    includeRemoved: boolean,
  ): Promise<AdminClosure[]> {
    const rows = await this.prisma.messClosure.findMany({
      where: {
        mealDate: { gte: toDbDate(from), ...(to && { lte: toDbDate(to) }) },
        ...(!includeRemoved && { status: 'ACTIVE' }),
      },
      include: CLOSURE_INCLUDE,
      orderBy: [{ mealDate: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(toAdminClosure);
  }

  async findById(id: string, tx: TransactionClient = this.prisma): Promise<AdminClosure | null> {
    const row = await tx.messClosure.findUnique({ where: { id }, include: CLOSURE_INCLUDE });
    return row ? toAdminClosure(row) : null;
  }

  async mealIds(
    mealTypes: MealType[],
    tx: TransactionClient = this.prisma,
  ): Promise<Map<MealType, string>> {
    const meals = await tx.meal.findMany({
      where: { mealType: { in: mealTypes }, isActive: true },
      select: { id: true, mealType: true },
    });
    return new Map(meals.map((meal) => [meal.mealType, meal.id]));
  }

  /** Meals already covered by an active closure that day (one closure per meal and date). */
  async alreadyClosed(
    date: BusinessDate,
    mealIds: string[],
    tx: TransactionClient,
  ): Promise<MealType[]> {
    const rows = await tx.messClosureMeal.findMany({
      where: { mealId: { in: mealIds }, closure: { mealDate: toDbDate(date), status: 'ACTIVE' } },
      select: { meal: { select: { mealType: true } } },
    });
    return rows.map((row) => row.meal.mealType);
  }

  async create(
    data: {
      date: BusinessDate;
      kind: ClosureKind;
      title: string;
      reason: string;
      mealIds: string[];
      staffId: string;
    },
    tx: TransactionClient,
  ): Promise<string> {
    const created = await tx.messClosure.create({
      data: {
        mealDate: toDbDate(data.date),
        kind: data.kind,
        title: data.title,
        reason: data.reason,
        createdById: data.staffId,
        meals: { create: data.mealIds.map((mealId) => ({ mealId })) },
      },
      select: { id: true },
    });
    return created.id;
  }

  /** Returns false if the closure was already removed (parallel removal). */
  async markRemoved(
    id: string,
    staffId: string,
    reason: string,
    now: Date,
    tx: TransactionClient,
  ): Promise<boolean> {
    const result = await tx.messClosure.updateMany({
      where: { id, status: 'ACTIVE' },
      data: { status: 'REMOVED', removedById: staffId, removedAt: now, removalReason: reason },
    });
    return result.count === 1;
  }

  /** Bookings on the date and meals with the given status, e.g. BOOKED to close or closure-cancelled to restore. */
  async bookingsWithStatus(
    date: BusinessDate,
    mealIds: string[],
    status: 'BOOKED' | 'CANCELLED_BY_CLOSURE',
    tx: TransactionClient = this.prisma,
  ): Promise<AffectedBooking[]> {
    const rows = await tx.booking.findMany({
      where: { mealDate: toDbDate(date), mealId: { in: mealIds }, status },
      select: {
        id: true,
        studentId: true,
        mealId: true,
        version: true,
        meal: { select: { mealType: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      studentId: row.studentId,
      mealId: row.mealId,
      mealType: row.meal.mealType,
      version: row.version,
    }));
  }

  async countBooked(date: BusinessDate, mealIds: string[]): Promise<Map<string, number>> {
    const rows = await this.prisma.booking.groupBy({
      by: ['mealId'],
      where: { mealDate: toDbDate(date), mealId: { in: mealIds }, status: 'BOOKED' },
      _count: { _all: true },
    });
    return new Map(rows.map((row) => [row.mealId, row._count._all]));
  }
}

function toAdminClosure(row: ClosureRow): AdminClosure {
  return {
    id: row.id,
    date: row.mealDate.toISOString().slice(0, 10),
    mealTypes: row.meals
      .map((meal) => meal.meal.mealType)
      .sort((a, b) => MEAL_ORDER[a] - MEAL_ORDER[b]),
    kind: row.kind,
    title: row.title,
    reason: row.reason,
    status: row.status,
    createdByName: row.createdBy.fullName,
    createdAt: row.createdAt.toISOString(),
    removedByName: row.removedBy?.fullName ?? null,
    removedAt: row.removedAt?.toISOString() ?? null,
    removalReason: row.removalReason,
  };
}
