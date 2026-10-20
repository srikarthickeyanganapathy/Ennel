import { Injectable } from '@nestjs/common';
import { type AdminMeal, MealType } from '@ennel/shared';
import { TransactionRunner } from '../../../../infrastructure/database/transaction-runner';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { buildSlotLabel, findMealWindowProblem } from '../domain/slot-rules';
import {
  AdminMessConfigRepository,
  type MealWindowUpdate,
} from '../repositories/admin-mess-config.repository';
import { invalid, notFound, staleVersion } from './config-errors';

export interface UpdateMealCommand extends MealWindowUpdate {
  id: string;
  version: number;
  reason?: string;
}

/**
 * Edits a meal's name and serving window (Admin §D). Breakfast's single slot follows its
 * window (BR-MEAL-1); for other meals every active slot must stay inside the window.
 */
@Injectable()
export class UpdateMealService {
  constructor(
    private readonly config: AdminMessConfigRepository,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
  ) {}

  execute(command: UpdateMealCommand): Promise<AdminMeal> {
    return this.transactions.run(async (tx) => {
      const before = await this.config.findMeal(command.id, tx);
      if (!before) throw notFound('Meal');
      const window = {
        startMinute: command.serviceStartMinute,
        endMinute: command.serviceEndMinute,
      };
      const isBreakfast = before.mealType === MealType.BREAKFAST;
      const activeSlots = before.slots.filter((slot) => slot.isActive);
      const problem = findMealWindowProblem(window, isBreakfast ? [] : activeSlots);
      if (problem) throw invalid('serviceStartMinute', problem);

      const { id, version, reason, ...data } = command;
      if (!(await this.config.updateMeal(id, version, data, tx))) throw staleVersion('meal');
      for (const slot of isBreakfast ? before.slots : []) {
        await this.config.updateSlot(
          slot.id,
          slot.version,
          { ...window, label: buildSlotLabel(window), defaultCapacity: slot.defaultCapacity },
          tx,
        );
      }
      const after = await this.config.findMeal(id, tx);
      if (!after) throw notFound('Meal');
      await this.audit.write(tx, {
        action: 'meal.update',
        entityType: 'meal',
        entityId: id,
        before: { ...before, slots: undefined },
        after: { ...after, slots: undefined },
        reason,
      });
      return after;
    });
  }
}
