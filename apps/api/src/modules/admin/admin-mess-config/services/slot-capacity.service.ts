import { Injectable } from '@nestjs/common';
import {
  addBusinessDays,
  type AdminSlot,
  type BusinessDate,
  type CapacityImpact,
  type CapacityOverride,
  getBusinessWeekday,
  toBusinessDate,
} from '@ennel/shared';
import { Clock } from '../../../../infrastructure/clock/clock';
import { TransactionRunner } from '../../../../infrastructure/database/transaction-runner';
import { GetMessPolicyService } from '../../../mess-config/services/get-mess-policy.service';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { listDates } from '../../admin-menus/domain/menu-rules';
import { AdminMessConfigRepository } from '../repositories/admin-mess-config.repository';
import { invalid, notFound } from './config-errors';

export type CapacityScope =
  | { scope: 'DEFAULT' }
  | { scope: 'WEEKDAY'; weekday: number }
  | { scope: 'DATE'; date: BusinessDate };

/**
 * Weekday capacities, per-date overrides and the "lowering capacity" impact check (Admin §D,
 * BR-CAP-1, BR-CAP-6). Lowering below current bookings is allowed; bookings are kept.
 */
@Injectable()
export class SlotCapacityService {
  constructor(
    private readonly config: AdminMessConfigRepository,
    private readonly policy: GetMessPolicyService,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly clock: Clock,
  ) {}

  setWeekdayCapacities(
    slotId: string,
    entries: { weekday: number; capacity: number | null }[],
    reason?: string,
  ): Promise<AdminSlot> {
    return this.transactions.run(async (tx) => {
      const before = await this.config.findSlot(slotId, tx);
      if (!before) throw notFound('Slot');
      await this.config.setWeekdayCapacities(slotId, entries, tx);
      const after = await this.config.findSlot(slotId, tx);
      if (!after) throw notFound('Slot');
      await this.audit.write(tx, {
        action: 'slot.weekday-capacities.set',
        entityType: 'meal_slot',
        entityId: slotId,
        before: before.weekdayCapacities,
        after: after.weekdayCapacities,
        reason,
      });
      return after;
    });
  }

  listOverrides(slotId: string): Promise<CapacityOverride[]> {
    return this.config.listOverrides(slotId, toBusinessDate(this.clock.now()));
  }

  setOverride(
    slotId: string,
    date: BusinessDate,
    capacity: number,
    reason: string,
    staffId: string,
  ): Promise<void> {
    this.assertNotPast(date);
    return this.transactions.run(async (tx) => {
      if (!(await this.config.findSlot(slotId, tx))) throw notFound('Slot');
      const before = await this.config.findOverride(slotId, date, tx);
      await this.config.upsertOverride(slotId, date, capacity, reason, staffId, tx);
      await this.audit.write(tx, {
        action: 'slot.capacity-override.set',
        entityType: 'meal_slot',
        entityId: slotId,
        before: before ? { mealDate: date, capacity: before.capacity } : null,
        after: { mealDate: date, capacity },
        reason,
      });
    });
  }

  removeOverride(slotId: string, date: BusinessDate, reason: string): Promise<void> {
    return this.transactions.run(async (tx) => {
      const before = await this.config.findOverride(slotId, date, tx);
      if (!before) throw notFound('Capacity override');
      await this.config.deleteOverride(slotId, date, tx);
      await this.audit.write(tx, {
        action: 'slot.capacity-override.remove',
        entityType: 'meal_slot',
        entityId: slotId,
        before: { mealDate: date, capacity: before.capacity },
        reason,
      });
    });
  }

  /** Dates in the booking horizon where the new capacity would be below current bookings. */
  async impact(slotId: string, capacity: number, target: CapacityScope): Promise<CapacityImpact> {
    const slot = await this.config.findSlot(slotId);
    if (!slot) throw notFound('Slot');
    const today = toBusinessDate(this.clock.now());
    const { bookingHorizonDays } = await this.policy.execute();
    const last = addBusinessDays(today, bookingHorizonDays);
    const [counts, overridden] = await Promise.all([
      this.config.bookedCounts(slotId, today, last),
      this.config.overrideDates(slotId, today, last),
    ]);
    const weekdaysWithDefaults = new Set(slot.weekdayCapacities.map((entry) => entry.weekday));
    const dates = this.datesInScope(target, today, bookingHorizonDays).filter((date) => {
      if (target.scope === 'DATE') return true;
      if (overridden.has(date)) return false;
      return target.scope === 'WEEKDAY' || !weekdaysWithDefaults.has(getBusinessWeekday(date));
    });
    const affectedDates = dates
      .map((mealDate) => ({ mealDate, bookedCount: counts.get(mealDate) ?? 0 }))
      .filter((entry) => entry.bookedCount > capacity)
      .map((entry) => ({ ...entry, overBy: entry.bookedCount - capacity }));
    return {
      affectedDates,
      totalOverBy: affectedDates.reduce((sum, entry) => sum + entry.overBy, 0),
    };
  }

  private datesInScope(
    target: CapacityScope,
    today: BusinessDate,
    horizon: number,
  ): BusinessDate[] {
    if (target.scope === 'DATE') return [target.date];
    const dates = listDates(today, horizon + 1);
    return target.scope === 'WEEKDAY'
      ? dates.filter((date) => getBusinessWeekday(date) === target.weekday)
      : dates;
  }

  private assertNotPast(date: BusinessDate): void {
    if (date < toBusinessDate(this.clock.now()))
      throw invalid('mealDate', 'Choose today or a future date.');
  }
}
