import { Injectable } from '@nestjs/common';
import { type DietType, type MealType } from '@ennel/shared';
import { type Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';

/** Only this student's preference row is loaded, for the no-show auto-disable flag. */
const ruleInclude = (studentId: string) =>
  ({
    meal: {
      select: {
        mealType: true,
        displayName: true,

        mealPreferences: { where: { studentId }, select: { autoDisabledAt: true } },
      },
    },
    slot: { select: { label: true } },
  }) satisfies Prisma.WeekdayRuleInclude;
type RuleRow = Prisma.WeekdayRuleGetPayload<{ include: ReturnType<typeof ruleInclude> }>;

export interface StoredWeekdayRule {
  id: string;
  mealId: string;
  mealType: MealType;
  mealName: string;
  weekdays: number[];
  slotId: string;
  slotLabel: string;
  dietType: DietType;
  version: number;
  /** The meal's no-show auto-disable (BR-NS-5) for this student. */
  isMealAutoDisabled: boolean;
}

export interface WeekdayRuleWrite {
  weekdays: number[];
  slotId: string;
  dietType: DietType;
}

/** Plan Ahead weekday rules (Spec §6.2). Deleted rules stay as inactive rows for history. */
@Injectable()
export class WeekdayRulesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Serialises rule changes per student so two saves cannot both pass the overlap check. */
  async lockStudent(studentId: string, tx: TransactionClient): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`weekday-rules:${studentId}`}, 0))`;
  }

  async listActive(
    studentId: string,
    tx: TransactionClient = this.prisma,
  ): Promise<StoredWeekdayRule[]> {
    const rows = await tx.weekdayRule.findMany({
      where: { studentId, isActive: true },
      include: ruleInclude(studentId),
      orderBy: [{ meal: { serviceStartMinute: 'asc' } }, { createdAt: 'asc' }],
    });
    return rows.map(toStored);
  }

  async findActive(
    studentId: string,
    id: string,
    tx: TransactionClient,
  ): Promise<StoredWeekdayRule | null> {
    const row = await tx.weekdayRule.findFirst({
      where: { id, studentId, isActive: true },
      include: ruleInclude(studentId),
    });
    return row ? toStored(row) : null;
  }

  async create(
    studentId: string,
    mealId: string,
    data: WeekdayRuleWrite,
    tx: TransactionClient,
  ): Promise<void> {
    await tx.weekdayRule.create({ data: { studentId, mealId, ...data } });
  }

  /** Returns false when the version no longer matches (someone else changed the rule). */
  async update(
    id: string,
    version: number,
    data: Partial<WeekdayRuleWrite> & { isActive?: boolean },
    tx: TransactionClient,
  ): Promise<boolean> {
    const result = await tx.weekdayRule.updateMany({
      where: { id, version, isActive: true },
      data: { ...data, version: { increment: 1 } },
    });
    return result.count === 1;
  }

  async isOverallEnabled(studentId: string, tx: TransactionClient = this.prisma): Promise<boolean> {
    const student = await tx.student.findUniqueOrThrow({
      where: { id: studentId },
      select: { defaultBookingEnabled: true },
    });
    return student.defaultBookingEnabled;
  }
}

function toStored(row: RuleRow): StoredWeekdayRule {
  return {
    id: row.id,
    mealId: row.mealId,
    mealType: row.meal.mealType,
    mealName: row.meal.displayName,
    weekdays: [...row.weekdays].sort((a, b) => a - b),
    slotId: row.slotId,
    slotLabel: row.slot.label,
    dietType: row.dietType,
    version: row.version,
    isMealAutoDisabled: Boolean(row.meal.mealPreferences[0]?.autoDisabledAt),
  };
}
