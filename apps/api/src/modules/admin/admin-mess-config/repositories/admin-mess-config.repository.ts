import { Injectable } from '@nestjs/common';
import {
  type AdminHostel,
  type AdminMeal,
  type AdminSlot,
  type BusinessDate,
  type CapacityOverride,
  type MealType,
  type SlotUsage,
} from '@ennel/shared';
import { type Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../../infrastructure/database/transaction-runner';

export interface SlotWithMeal extends AdminSlot {
  mealType: MealType;
  meal: { startMinute: number; endMinute: number };
}

export interface MealWindowUpdate {
  displayName: string;
  serviceStartMinute: number;
  serviceEndMinute: number;
  attendanceGraceMinutes: number;
}

export interface SlotFields {
  label: string;
  startMinute: number;
  endMinute: number;
  defaultCapacity: number;
}

export interface SlotChangeActor {
  staffId: string;
  reason: string;
}

export interface ReassignResult {
  bookings: number;
  preferences: number;
  weekdayRules: number;
  dateExceptions: number;
}

const MEAL_ORDER: Record<MealType, number> = { BREAKFAST: 0, LUNCH: 1, DINNER: 2 };
const SLOT_INCLUDE = {
  weekdayCapacities: { orderBy: { weekday: 'asc' } },
} satisfies Prisma.MealSlotInclude;
type SlotRow = Prisma.MealSlotGetPayload<{ include: typeof SLOT_INCLUDE }>;

const toDate = (date: BusinessDate) => new Date(`${date}T00:00:00Z`);
const fromDate = (date: Date) => date.toISOString().slice(0, 10);

function toSlot(row: SlotRow): AdminSlot {
  return {
    id: row.id,
    mealId: row.mealId,
    label: row.label,
    startMinute: row.startMinute,
    endMinute: row.endMinute,
    sortOrder: row.sortOrder,
    defaultCapacity: row.defaultCapacity,
    isActive: row.isActive,
    version: row.version,
    weekdayCapacities: row.weekdayCapacities.map(({ weekday, capacity }) => ({
      weekday,
      capacity,
    })),
  };
}

@Injectable()
export class AdminMessConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listMeals(tx: TransactionClient = this.prisma): Promise<AdminMeal[]> {
    const meals = await tx.meal.findMany({
      include: {
        slots: {
          where: { deletedAt: null },
          orderBy: { startMinute: 'asc' },
          include: SLOT_INCLUDE,
        },
      },
    });
    return meals
      .sort((a, b) => MEAL_ORDER[a.mealType] - MEAL_ORDER[b.mealType])
      .map(({ slots, updatedAt: _updatedAt, ...meal }) => ({ ...meal, slots: slots.map(toSlot) }));
  }

  async findMeal(id: string, tx: TransactionClient = this.prisma): Promise<AdminMeal | null> {
    return (await this.listMeals(tx)).find((meal) => meal.id === id) ?? null;
  }

  async findSlot(id: string, tx: TransactionClient = this.prisma): Promise<SlotWithMeal | null> {
    const row = await tx.mealSlot.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...SLOT_INCLUDE,
        meal: { select: { mealType: true, serviceStartMinute: true, serviceEndMinute: true } },
      },
    });
    if (!row) return null;
    return {
      ...toSlot(row),
      mealType: row.meal.mealType,
      meal: { startMinute: row.meal.serviceStartMinute, endMinute: row.meal.serviceEndMinute },
    };
  }

  async updateMeal(
    id: string,
    version: number,
    data: MealWindowUpdate,
    tx: TransactionClient,
  ): Promise<boolean> {
    const result = await tx.meal.updateMany({
      where: { id, version },
      data: { ...data, version: { increment: 1 } },
    });
    return result.count === 1;
  }

  /**
   * Serializes slot changes of one meal until the transaction ends. Overlap and reassignment
   * checks (BR-MEAL-4/5) read other slots, so two parallel changes must not both pass them.
   * Callers lock first and read afterwards.
   */
  async lockMeal(mealId: string, tx: TransactionClient): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`meal-slots:${mealId}`}::text))`;
  }

  /** Locks the slot's meal; false if the slot does not exist. */
  async lockMealOfSlot(slotId: string, tx: TransactionClient): Promise<boolean> {
    const slot = await tx.mealSlot.findUnique({ where: { id: slotId }, select: { mealId: true } });
    if (!slot) return false;
    await this.lockMeal(slot.mealId, tx);
    return true;
  }

  async createSlot(mealId: string, fields: SlotFields, tx: TransactionClient): Promise<string> {
    const slot = await tx.mealSlot.create({
      data: { mealId, ...fields, sortOrder: 0 },
      select: { id: true },
    });
    await this.resequenceSlots(mealId, tx);
    return slot.id;
  }

  /** Keeps `sortOrder` in serving order (by start time), which clients use to list slots. */
  async resequenceSlots(mealId: string, tx: TransactionClient): Promise<void> {
    const slots = await tx.mealSlot.findMany({
      where: { mealId, deletedAt: null },
      orderBy: [{ startMinute: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, sortOrder: true },
    });
    for (const [index, slot] of slots.entries()) {
      if (slot.sortOrder === index + 1) continue;
      await tx.mealSlot.update({ where: { id: slot.id }, data: { sortOrder: index + 1 } });
    }
  }

  async updateSlot(
    id: string,
    version: number,
    fields: SlotFields,
    tx: TransactionClient,
  ): Promise<boolean> {
    const result = await tx.mealSlot.updateMany({
      where: { id, version, deletedAt: null },
      data: { ...fields, version: { increment: 1 } },
    });
    return result.count === 1;
  }

  async setSlotActive(id: string, isActive: boolean, tx: TransactionClient): Promise<void> {
    await tx.mealSlot.update({ where: { id }, data: { isActive, version: { increment: 1 } } });
  }

  async softDeleteSlot(id: string, now: Date, tx: TransactionClient): Promise<void> {
    await tx.mealSlot.update({
      where: { id },
      data: { deletedAt: now, isActive: false, version: { increment: 1 } },
    });
  }

  async slotUsage(
    slotId: string,
    today: BusinessDate,
    tx: TransactionClient = this.prisma,
  ): Promise<SlotUsage> {
    const from = toDate(today);
    const [futureBookings, preferences, weekdayRules, dateExceptions] = await Promise.all([
      tx.booking.count({ where: { slotId, status: 'BOOKED', mealDate: { gte: from } } }),
      tx.mealPreference.count({ where: { slotId } }),
      tx.weekdayRule.count({ where: { slotId, isActive: true } }),
      tx.dateException.count({ where: { slotId, mealDate: { gte: from } } }),
    ]);
    return { futureBookings, preferences, weekdayRules, dateExceptions };
  }

  /** Disable + reassign flow (Admin §D): future bookings and saved choices move to the target slot. */
  async reassignSlot(
    fromSlotId: string,
    toSlotId: string,
    today: BusinessDate,
    actor: SlotChangeActor,
    tx: TransactionClient,
  ): Promise<ReassignResult> {
    const from = toDate(today);
    const bookings = await this.moveBookings(fromSlotId, toSlotId, from, actor, tx);
    const [preferences, weekdayRules, dateExceptions] = await Promise.all([
      tx.mealPreference.updateMany({
        where: { slotId: fromSlotId },
        data: { slotId: toSlotId, version: { increment: 1 } },
      }),
      tx.weekdayRule.updateMany({
        where: { slotId: fromSlotId, isActive: true },
        data: { slotId: toSlotId },
      }),
      tx.dateException.updateMany({
        where: { slotId: fromSlotId, mealDate: { gte: from } },
        data: { slotId: toSlotId },
      }),
    ]);
    return {
      bookings,
      preferences: preferences.count,
      weekdayRules: weekdayRules.count,
      dateExceptions: dateExceptions.count,
    };
  }

  /**
   * A slot change updates the booking and appends a booking event (BR-BOOK-7), and the booking
   * is marked as last changed by staff so the student sees "Updated by mess staff" (Admin §H).
   */
  private async moveBookings(
    fromSlotId: string,
    toSlotId: string,
    from: Date,
    actor: SlotChangeActor,
    tx: TransactionClient,
  ): Promise<number> {
    const moving = await tx.booking.findMany({
      where: { slotId: fromSlotId, status: 'BOOKED', mealDate: { gte: from } },
      select: { id: true },
    });
    const ids = moving.map((booking) => booking.id);
    if (ids.length === 0) return 0;
    await tx.booking.updateMany({
      where: { id: { in: ids } },
      data: {
        slotId: toSlotId,
        lastActorType: 'STAFF',
        lastActorStaffId: actor.staffId,
        version: { increment: 1 },
      },
    });
    await tx.bookingEvent.createMany({
      data: ids.map((bookingId) => ({
        bookingId,
        type: 'SLOT_CHANGED' as const,
        payload: { fromSlotId, toSlotId },
        actorType: 'STAFF' as const,
        actorStaffId: actor.staffId,
        reason: actor.reason,
      })),
    });
    return ids.length;
  }

  async setWeekdayCapacities(
    slotId: string,
    entries: { weekday: number; capacity: number | null }[],
    tx: TransactionClient,
  ): Promise<void> {
    for (const { weekday, capacity } of entries) {
      if (capacity === null) {
        await tx.slotWeekdayCapacity.deleteMany({ where: { slotId, weekday } });
      } else {
        await tx.slotWeekdayCapacity.upsert({
          where: { slotId_weekday: { slotId, weekday } },
          create: { slotId, weekday, capacity },
          update: { capacity },
        });
      }
    }
  }

  async listOverrides(slotId: string, from: BusinessDate): Promise<CapacityOverride[]> {
    const rows = await this.prisma.slotCapacityOverride.findMany({
      where: { slotId, mealDate: { gte: toDate(from) } },
      orderBy: { mealDate: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      slotId: row.slotId,
      mealDate: fromDate(row.mealDate),
      capacity: row.capacity,
      reason: row.reason,
    }));
  }

  async findOverride(
    slotId: string,
    date: BusinessDate,
    tx: TransactionClient,
  ): Promise<CapacityOverride | null> {
    const row = await tx.slotCapacityOverride.findUnique({
      where: { slotId_mealDate: { slotId, mealDate: toDate(date) } },
    });
    return row
      ? { id: row.id, slotId, mealDate: date, capacity: row.capacity, reason: row.reason }
      : null;
  }

  async upsertOverride(
    slotId: string,
    date: BusinessDate,
    capacity: number,
    reason: string,
    staffId: string,
    tx: TransactionClient,
  ): Promise<void> {
    await tx.slotCapacityOverride.upsert({
      where: { slotId_mealDate: { slotId, mealDate: toDate(date) } },
      create: { slotId, mealDate: toDate(date), capacity, reason, createdById: staffId },
      update: { capacity, reason },
    });
  }

  async deleteOverride(slotId: string, date: BusinessDate, tx: TransactionClient): Promise<void> {
    await tx.slotCapacityOverride.deleteMany({ where: { slotId, mealDate: toDate(date) } });
  }

  /** BOOKED bookings per date for the slot, for capacity-impact warnings. */
  async bookedCounts(
    slotId: string,
    from: BusinessDate,
    to: BusinessDate,
  ): Promise<Map<BusinessDate, number>> {
    const groups = await this.prisma.booking.groupBy({
      by: ['mealDate'],
      where: { slotId, status: 'BOOKED', mealDate: { gte: toDate(from), lte: toDate(to) } },
      _count: { _all: true },
    });
    return new Map(groups.map((group) => [fromDate(group.mealDate), group._count._all]));
  }

  async overrideDates(
    slotId: string,
    from: BusinessDate,
    to: BusinessDate,
  ): Promise<Set<BusinessDate>> {
    const rows = await this.prisma.slotCapacityOverride.findMany({
      where: { slotId, mealDate: { gte: toDate(from), lte: toDate(to) } },
      select: { mealDate: true },
    });
    return new Set(rows.map((row) => fromDate(row.mealDate)));
  }

  async listHostels(): Promise<AdminHostel[]> {
    const hostels = await this.prisma.hostel.findMany({
      orderBy: { name: 'asc' },
      include: {
        blocks: { orderBy: { name: 'asc' }, include: { _count: { select: { students: true } } } },
      },
    });
    return hostels.map((hostel) => ({
      id: hostel.id,
      name: hostel.name,
      isActive: hostel.isActive,
      blocks: hostel.blocks.map((block) => ({
        id: block.id,
        name: block.name,
        isActive: block.isActive,
        studentCount: block._count.students,
      })),
    }));
  }

  async createHostel(name: string, tx: TransactionClient): Promise<string> {
    return (await tx.hostel.create({ data: { name }, select: { id: true } })).id;
  }

  async createBlock(hostelId: string, name: string, tx: TransactionClient): Promise<string> {
    return (await tx.hostelBlock.create({ data: { hostelId, name }, select: { id: true } })).id;
  }

  async updateHostel(
    id: string,
    data: { name?: string; isActive?: boolean },
    tx: TransactionClient,
  ): Promise<void> {
    await tx.hostel.update({ where: { id }, data });
  }

  async updateBlock(
    id: string,
    data: { name?: string; isActive?: boolean },
    tx: TransactionClient,
  ): Promise<void> {
    await tx.hostelBlock.update({ where: { id }, data });
  }

  async hostelNameExists(name: string, excludingId?: string): Promise<boolean> {
    const count = await this.prisma.hostel.count({
      where: {
        name: { equals: name, mode: 'insensitive' },
        id: excludingId ? { not: excludingId } : undefined,
      },
    });
    return count > 0;
  }

  async findHostel(id: string): Promise<{ id: string; name: string; isActive: boolean } | null> {
    return this.prisma.hostel.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true },
    });
  }

  async findBlock(
    id: string,
  ): Promise<{ id: string; hostelId: string; name: string; isActive: boolean } | null> {
    return this.prisma.hostelBlock.findUnique({
      where: { id },
      select: { id: true, hostelId: true, name: true, isActive: true },
    });
  }

  async blockNameExists(hostelId: string, name: string, excludingId?: string): Promise<boolean> {
    const count = await this.prisma.hostelBlock.count({
      where: {
        hostelId,
        name: { equals: name, mode: 'insensitive' },
        id: excludingId ? { not: excludingId } : undefined,
      },
    });
    return count > 0;
  }
}
