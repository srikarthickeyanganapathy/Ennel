import { Injectable } from '@nestjs/common';
import { type AdminSlot, ErrorCode, type SlotUsage, toBusinessDate } from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';
import { Clock } from '../../../../infrastructure/clock/clock';
import { TransactionRunner } from '../../../../infrastructure/database/transaction-runner';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { findSlotWindowProblem, isSlotInUse } from '../domain/slot-rules';
import { AdminMessConfigRepository } from '../repositories/admin-mess-config.repository';
import { invalid, notFound } from './config-errors';

/**
 * Disable, re-enable and delete slots (Admin §D). A slot that still has future bookings or
 * saved choices cannot be deleted, and can only be disabled by moving them to another slot.
 */
@Injectable()
export class SlotLifecycleService {
  constructor(
    private readonly config: AdminMessConfigRepository,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly clock: Clock,
  ) {}

  usage(slotId: string): Promise<SlotUsage> {
    return this.config.slotUsage(slotId, toBusinessDate(this.clock.now()));
  }

  disable(slotId: string, reason: string, reassignToSlotId?: string): Promise<AdminSlot> {
    const today = toBusinessDate(this.clock.now());
    return this.transactions.run(async (tx) => {
      const slot = await this.config.findSlot(slotId, tx);
      if (!slot) throw notFound('Slot');
      if (!slot.isActive) throw invalid('slotId', 'This slot is already disabled.');
      if (slot.mealType === 'BREAKFAST')
        throw invalid('slotId', 'Breakfast always has its one serving window.');
      const usage = await this.config.slotUsage(slotId, today, tx);
      const moved = isSlotInUse(usage)
        ? await this.reassign(slot, usage, today, reassignToSlotId, tx)
        : null;
      await this.config.setSlotActive(slotId, false, tx);
      await this.audit.write(tx, {
        action: 'slot.disable',
        entityType: 'meal_slot',
        entityId: slotId,
        before: { isActive: true, usage },
        after: { isActive: false, reassignedTo: reassignToSlotId ?? null, moved },
        reason,
      });
      return this.requireSlot(slotId, tx);
    });
  }

  enable(slotId: string, reason: string): Promise<AdminSlot> {
    return this.transactions.run(async (tx) => {
      const slot = await this.config.findSlot(slotId, tx);
      if (!slot) throw notFound('Slot');
      const meal = await this.config.findMeal(slot.mealId, tx);
      const others = (meal?.slots ?? []).filter((other) => other.isActive && other.id !== slotId);
      const problem = findSlotWindowProblem(slot, slot.meal, others);
      if (problem) throw invalid('slotId', problem);
      await this.config.setSlotActive(slotId, true, tx);
      await this.audit.write(tx, {
        action: 'slot.enable',
        entityType: 'meal_slot',
        entityId: slotId,
        after: { isActive: true },
        reason,
      });
      return this.requireSlot(slotId, tx);
    });
  }

  delete(slotId: string, reason: string): Promise<void> {
    const today = toBusinessDate(this.clock.now());
    return this.transactions.run(async (tx) => {
      const slot = await this.config.findSlot(slotId, tx);
      if (!slot) throw notFound('Slot');
      if (slot.mealType === 'BREAKFAST')
        throw invalid('slotId', 'Breakfast always has its one serving window.');
      const usage = await this.config.slotUsage(slotId, today, tx);
      if (isSlotInUse(usage)) {
        throw new AppError(
          ErrorCode.VALIDATION_FAILED,
          'This slot is in use. Disable it and move its bookings instead.',
          { usage },
        );
      }
      await this.config.softDeleteSlot(slotId, this.clock.now(), tx);
      await this.audit.write(tx, {
        action: 'slot.delete',
        entityType: 'meal_slot',
        entityId: slotId,
        before: slot,
        reason,
      });
    });
  }

  private async reassign(
    slot: AdminSlot,
    usage: SlotUsage,
    today: string,
    targetId: string | undefined,
    tx: Parameters<AdminMessConfigRepository['reassignSlot']>[3],
  ) {
    if (!targetId) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        'This slot is in use. Choose a slot to move its bookings to.',
        { usage },
      );
    }
    const target = await this.config.findSlot(targetId, tx);
    if (!target || target.mealId !== slot.mealId || !target.isActive || target.id === slot.id) {
      throw invalid('reassignToSlotId', 'Choose another active slot of the same meal.');
    }
    return this.config.reassignSlot(slot.id, targetId, today, tx);
  }

  private async requireSlot(
    slotId: string,
    tx: Parameters<AdminMessConfigRepository['findSlot']>[1],
  ): Promise<AdminSlot> {
    const slot = await this.config.findSlot(slotId, tx);
    if (!slot) throw notFound('Slot');
    return slot;
  }
}
