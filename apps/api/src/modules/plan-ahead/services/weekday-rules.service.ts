import { Injectable } from '@nestjs/common';
import {
  type createWeekdayRulesRequestSchema,
  ErrorCode,
  type MealConfig,
  type MealType,
  type updateWeekdayRuleRequestSchema,
  type WeekdayRule,
  type WeekdayRuleResult,
} from '@ennel/shared';
import { type z } from 'zod';
import { AppError } from '../../../common/errors/app-error';
import {
  type TransactionClient,
  TransactionRunner,
} from '../../../infrastructure/database/transaction-runner';
import { SyncStudentBookingsService } from '../../default-preferences/services/sync-student-bookings.service';
import { ListMealsService } from '../../mess-config/services/list-meals.service';
import { describeDays, findOverlappingDays, rulePausedReason } from '../domain/weekday-rule-checks';
import {
  type StoredWeekdayRule,
  WeekdayRulesRepository,
} from '../repositories/weekday-rules.repository';

type CreateRequest = z.output<typeof createWeekdayRulesRequestSchema>;
type UpdateRequest = z.output<typeof updateWeekdayRuleRequestSchema>;

/** Rule changes re-sync the whole booking period; well above Prisma's 5-second default. */
const RULE_TIMEOUT_MS = 30_000;

/**
 * Spec §6.2 weekday rules (BR-PLAN): recurring exceptions to Default Booking. Every change
 * updates the student's upcoming bookings in the same transaction (BR-PLAN-3, ADR-0024).
 */
@Injectable()
export class WeekdayRulesService {
  constructor(
    private readonly rules: WeekdayRulesRepository,
    private readonly meals: ListMealsService,
    private readonly sync: SyncStudentBookingsService,
    private readonly transactions: TransactionRunner,
  ) {}

  async list(studentId: string): Promise<WeekdayRule[]> {
    const isOverallEnabled = await this.rules.isOverallEnabled(studentId);
    return (await this.rules.listActive(studentId)).map((rule) =>
      toWeekdayRule(rule, isOverallEnabled),
    );
  }

  async create(studentId: string, request: CreateRequest): Promise<WeekdayRuleResult> {
    const meals = await this.meals.execute();
    return this.write(studentId, async (tx, existing) => {
      for (const choice of request.meals) {
        const meal = mealWithSlot(meals, choice.mealType, choice.slotId);
        assertNoOverlap(existing, { mealType: choice.mealType, weekdays: request.weekdays });
        await this.rules.create(
          studentId,
          meal.id,
          { weekdays: request.weekdays, slotId: choice.slotId, dietType: choice.dietType },
          tx,
        );
      }
    });
  }

  async update(studentId: string, id: string, request: UpdateRequest): Promise<WeekdayRuleResult> {
    const meals = await this.meals.execute();
    return this.write(studentId, async (tx, existing) => {
      const rule = await this.findOwn(studentId, id, tx);
      if (request.slotId) mealWithSlot(meals, rule.mealType, request.slotId);
      if (request.weekdays) {
        assertNoOverlap(existing, {
          mealType: rule.mealType,
          weekdays: request.weekdays,
          excludeId: id,
        });
      }
      const { version, ...changes } = request;
      if (!(await this.rules.update(id, version, changes, tx))) throw versionConflict();
    });
  }

  async remove(studentId: string, id: string, version: number): Promise<WeekdayRuleResult> {
    return this.write(studentId, async (tx) => {
      await this.findOwn(studentId, id, tx);
      if (!(await this.rules.update(id, version, { isActive: false }, tx))) throw versionConflict();
    });
  }

  /** Lock, change, re-sync bookings, then return the fresh list (one transaction). */
  private async write(
    studentId: string,
    change: (tx: TransactionClient, existing: StoredWeekdayRule[]) => Promise<void>,
  ): Promise<WeekdayRuleResult> {
    const bookingsUpdated = await this.transactions.run(
      async (tx) => {
        await this.rules.lockStudent(studentId, tx);
        await change(tx, await this.rules.listActive(studentId, tx));
        return this.sync.execute(studentId, tx);
      },
      { timeoutMs: RULE_TIMEOUT_MS },
    );
    return { items: await this.list(studentId), bookingsUpdated };
  }

  /** Another student's rule is reported as missing, so rule IDs reveal nothing. */
  private async findOwn(
    studentId: string,
    id: string,
    tx: TransactionClient,
  ): Promise<StoredWeekdayRule> {
    const rule = await this.rules.findActive(studentId, id, tx);
    if (!rule) throw new AppError(ErrorCode.NOT_FOUND, 'This weekday rule was not found.');
    return rule;
  }
}

function mealWithSlot(meals: MealConfig[], mealType: MealType, slotId: string): MealConfig {
  const meal = meals.find((candidate) => candidate.mealType === mealType);
  if (!meal) throw invalid('meals', 'This meal is not being served.');
  if (!meal.slots.some((slot) => slot.id === slotId)) {
    throw invalid('slotId', `Choose one of the current ${meal.displayName.toLowerCase()} slots.`);
  }
  return meal;
}

function assertNoOverlap(
  existing: StoredWeekdayRule[],
  candidate: { mealType: MealType; weekdays: number[]; excludeId?: string },
): void {
  const clash = findOverlappingDays(existing, candidate);
  if (clash.length === 0) return;
  const mealName = existing.find((rule) => rule.mealType === candidate.mealType)?.mealName;
  throw invalid(
    'weekdays',
    `${mealName ?? 'This meal'} already has a weekday rule on ${describeDays(clash)}. Edit that rule instead.`,
  );
}

function toWeekdayRule(rule: StoredWeekdayRule, isOverallEnabled: boolean): WeekdayRule {
  return {
    id: rule.id,
    mealType: rule.mealType,
    mealName: rule.mealName,
    weekdays: rule.weekdays,
    slotId: rule.slotId,
    slotLabel: rule.slotLabel,
    dietType: rule.dietType,
    version: rule.version,
    pausedReason: rulePausedReason({
      isOverallEnabled,
      isAutoDisabled: rule.isMealAutoDisabled,
    }),
  };
}

function invalid(path: string, message: string): AppError {
  return new AppError(ErrorCode.VALIDATION_FAILED, message, { issues: [{ path, message }] });
}

function versionConflict(): AppError {
  return new AppError(
    ErrorCode.VERSION_CONFLICT,
    'This rule was changed somewhere else. Reload and try again.',
  );
}
