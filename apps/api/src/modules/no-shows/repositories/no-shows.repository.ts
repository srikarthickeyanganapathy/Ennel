import { Injectable } from '@nestjs/common';
import {
  type AppealStatus,
  type BusinessDate,
  type MealType,
  type NoShowAppealSummary,
  type NoShowStatus,
} from '@ennel/shared';
import { type Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';

const toDbDate = (date: BusinessDate) => new Date(`${date}T00:00:00Z`);
const fromDbDate = (date: Date): BusinessDate => date.toISOString().slice(0, 10);

type ExclusionCause = 'APPEAL_APPROVED' | 'STAFF_RESET' | 'OUTAGE_REVIEW_DISMISSED';

export interface StoredNoShow {
  id: string;
  bookingId: string;
  studentId: string;
  date: BusinessDate;
  mealType: MealType;
  status: NoShowStatus;
  exclusionCause: ExclusionCause | null;
  appeal: NoShowAppealSummary | null;
}

export interface MealPreferenceFlag {
  mealId: string;
  isAutoDisabled: boolean;
}

const APPEAL_SELECT = {
  id: true,
  status: true,
  message: true,
  decisionReason: true,
  createdAt: true,
  decidedAt: true,
} as const;

/** No-show events, appeals and the auto-disable flag (BR-NS, ADR-0009, ADR-0027). */
@Injectable()
export class NoShowsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Serialises count changes for one student so a disable is decided once. */
  async lockStudent(studentId: string, tx: TransactionClient): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`no-shows:${studentId}`}, 0))`;
  }

  async eventsForStudent(
    studentId: string,
    from: BusinessDate,
    tx: TransactionClient = this.prisma,
    mealType?: MealType,
  ): Promise<StoredNoShow[]> {
    const rows = await tx.noShowEvent.findMany({
      where: { studentId, mealDate: { gte: toDbDate(from) }, ...(mealType && { mealType }) },
      orderBy: [{ mealDate: 'desc' }, { createdAt: 'desc' }],
      include: { appeals: { select: APPEAL_SELECT, orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    return rows.map(toStored);
  }

  async findEvent(id: string, tx: TransactionClient = this.prisma): Promise<StoredNoShow | null> {
    const row = await tx.noShowEvent.findUnique({
      where: { id },
      include: { appeals: { select: APPEAL_SELECT, orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    return row ? toStored(row) : null;
  }

  async preferenceFlags(
    studentId: string,
    tx: TransactionClient = this.prisma,
  ): Promise<Map<MealType, MealPreferenceFlag>> {
    const rows = await tx.mealPreference.findMany({
      where: { studentId },
      select: { mealId: true, autoDisabledAt: true, meal: { select: { mealType: true } } },
    });
    return new Map(
      rows.map((row) => [
        row.meal.mealType,
        { mealId: row.mealId, isAutoDisabled: row.autoDisabledAt !== null },
      ]),
    );
  }

  async setAutoDisabled(
    studentId: string,
    mealId: string,
    eventId: string | null,
    now: Date,
    tx: TransactionClient,
  ): Promise<boolean> {
    const result = await tx.mealPreference.updateMany({
      where: { studentId, mealId, autoDisabledAt: null },
      data: { autoDisabledAt: now, autoDisabledByEventId: eventId, version: { increment: 1 } },
    });
    return result.count === 1;
  }

  async clearAutoDisabled(
    studentId: string,
    mealId: string,
    tx: TransactionClient,
  ): Promise<boolean> {
    const result = await tx.mealPreference.updateMany({
      where: { studentId, mealId, autoDisabledAt: { not: null } },
      data: { autoDisabledAt: null, autoDisabledByEventId: null, version: { increment: 1 } },
    });
    return result.count === 1;
  }

  /** Moves an event from one status to another; false if it changed meanwhile. */
  async changeStatus(
    id: string,
    from: NoShowStatus,
    to: NoShowStatus,
    exclusion: {
      cause: ExclusionCause;
      staffId: string | null;
      reason: string | null;
      now: Date;
    } | null,
    tx: TransactionClient,
  ): Promise<boolean> {
    const result = await tx.noShowEvent.updateMany({
      where: { id, status: from },
      data: {
        status: to,
        ...(exclusion && {
          exclusionCause: exclusion.cause,
          excludedById: exclusion.staffId,
          excludedReason: exclusion.reason,
          excludedAt: exclusion.now,
        }),
      },
    });
    return result.count === 1;
  }

  /** BR-NS-8: a staff reset excludes the counted events of one meal in the window. */
  async excludeCounted(
    studentId: string,
    mealType: MealType,
    from: BusinessDate,
    exclusion: { staffId: string; reason: string; now: Date },
    tx: TransactionClient,
  ): Promise<number> {
    const result = await tx.noShowEvent.updateMany({
      where: { studentId, mealType, status: 'COUNTED', mealDate: { gte: toDbDate(from) } },
      data: {
        status: 'EXCLUDED',
        exclusionCause: 'STAFF_RESET',
        excludedById: exclusion.staffId,
        excludedReason: exclusion.reason,
        excludedAt: exclusion.now,
      },
    });
    return result.count;
  }

  async createAppeal(
    eventId: string,
    studentId: string,
    message: string,
    tx: TransactionClient,
  ): Promise<string> {
    const row = await tx.noShowAppeal.create({
      data: { eventId, studentId, message },
      select: { id: true },
    });
    return row.id;
  }

  async findAppeal(id: string, tx: TransactionClient = this.prisma) {
    return tx.noShowAppeal.findUnique({
      where: { id },
      select: { id: true, eventId: true, studentId: true, status: true },
    });
  }

  async decideAppeal(
    id: string,
    status: Exclude<AppealStatus, 'PENDING'>,
    staffId: string,
    reason: string | null,
    now: Date,
    tx: TransactionClient,
  ): Promise<boolean> {
    const result = await tx.noShowAppeal.updateMany({
      where: { id, status: 'PENDING' },
      data: { status, decidedById: staffId, decisionReason: reason, decidedAt: now },
    });
    return result.count === 1;
  }
}

type EventRow = Prisma.NoShowEventGetPayload<{
  include: { appeals: { select: typeof APPEAL_SELECT } };
}>;

function toStored(row: EventRow): StoredNoShow {
  return {
    id: row.id,
    bookingId: row.bookingId,
    studentId: row.studentId,
    date: fromDbDate(row.mealDate),
    mealType: row.mealType,
    status: row.status,
    exclusionCause: row.exclusionCause,
    appeal: row.appeals[0] ? toAppeal(row.appeals[0]) : null,
  };
}

function toAppeal(row: {
  id: string;
  status: AppealStatus;
  message: string;
  decisionReason: string | null;
  createdAt: Date;
  decidedAt: Date | null;
}): NoShowAppealSummary {
  return {
    id: row.id,
    status: row.status,
    message: row.message,
    decisionReason: row.decisionReason,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
  };
}
