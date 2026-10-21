import { Injectable } from '@nestjs/common';
import { type AdminSlot } from '@ennel/shared';
import { TransactionRunner } from '../../../../infrastructure/database/transaction-runner';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { buildSlotLabel, canAddSlot, findSlotWindowProblem } from '../domain/slot-rules';
import { AdminMessConfigRepository } from '../repositories/admin-mess-config.repository';
import { invalid, notFound, staleVersion } from './config-errors';

export interface SlotInput {
  startMinute: number;
  endMinute: number;
  defaultCapacity: number;
  label?: string;
}

/** Add or edit a slot (Admin §D); every change is audited. */
@Injectable()
export class SaveSlotService {
  constructor(
    private readonly config: AdminMessConfigRepository,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
  ) {}

  create(mealId: string, input: SlotInput): Promise<AdminSlot> {
    return this.transactions.run(async (tx) => {
      // Lock before reading the other slots, so two parallel creates cannot both pass the overlap check.
      await this.config.lockMeal(mealId, tx);
      const meal = await this.config.findMeal(mealId, tx);
      if (!meal) throw notFound('Meal');
      if (!canAddSlot(meal.mealType))
        throw invalid('mealId', 'Breakfast has a single serving window; edit the meal instead.');
      const others = meal.slots.filter((slot) => slot.isActive);
      this.assertWindow(
        input,
        { startMinute: meal.serviceStartMinute, endMinute: meal.serviceEndMinute },
        others,
      );
      const id = await this.config.createSlot(mealId, this.fields(input), tx);
      const slot = await this.config.findSlot(id, tx);
      if (!slot) throw notFound('Slot');
      await this.audit.write(tx, {
        action: 'slot.create',
        entityType: 'meal_slot',
        entityId: id,
        after: slot,
      });
      return slot;
    });
  }

  update(slotId: string, version: number, input: SlotInput, reason?: string): Promise<AdminSlot> {
    return this.transactions.run(async (tx) => {
      if (!(await this.config.lockMealOfSlot(slotId, tx))) throw notFound('Slot');
      const before = await this.config.findSlot(slotId, tx);
      if (!before) throw notFound('Slot');
      const meal = await this.config.findMeal(before.mealId, tx);
      const others = (meal?.slots ?? []).filter((slot) => slot.isActive && slot.id !== slotId);
      const window = before.mealType === 'BREAKFAST' ? { ...input, ...before.meal } : input;
      this.assertWindow(window, before.meal, before.isActive ? others : []);
      if (!(await this.config.updateSlot(slotId, version, this.fields(window), tx)))
        throw staleVersion('slot');
      await this.config.resequenceSlots(before.mealId, tx);
      const after = await this.config.findSlot(slotId, tx);
      if (!after) throw notFound('Slot');
      await this.audit.write(tx, {
        action: 'slot.update',
        entityType: 'meal_slot',
        entityId: slotId,
        before,
        after,
        reason,
      });
      return after;
    });
  }

  private assertWindow(
    slot: SlotInput,
    meal: { startMinute: number; endMinute: number },
    others: AdminSlot[],
  ): void {
    const problem = findSlotWindowProblem(slot, meal, others);
    if (problem) throw invalid('startMinute', problem);
  }

  private fields(input: SlotInput) {
    return {
      startMinute: input.startMinute,
      endMinute: input.endMinute,
      defaultCapacity: input.defaultCapacity,
      label: input.label ?? buildSlotLabel(input),
    };
  }
}
