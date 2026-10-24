import { Injectable } from '@nestjs/common';
import {
  type ActorType,
  type BookingSource,
  BookingStatus,
  type BusinessDate,
  type DietType,
  getBusinessWeekday,
  type MealType,
} from '@ennel/shared';
import { type Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';
import { resolveOfficialCapacity } from '../../mess-config/domain/capacity';
import { type DateExceptionIntent } from '../domain/resolve-effective-booking';
import { type LeaveRange } from '../domain/leave-coverage';

export interface SlotRow {
  id: string;
  mealId: string;
  label: string;
  startMinute: number;
  endMinute: number;
  isActive: boolean;
}

export interface BookingRow {
  id: string;
  studentId: string;
  mealId: string;
  mealDate: BusinessDate;
  slot: SlotRow;
  dietType: DietType;
  status: BookingStatus;
  source: BookingSource;
  isOverCapacity: boolean;
  lastActorType: ActorType;
  version: number;
}

export interface MealDayRow {
  mealId: string;
  mealType: MealType;
  mealName: string;
  serviceStartMinute: number;
  serviceEndMinute: number;
  slots: SlotRow[];
  closureTitle: string | null;
  preference: {
    isEnabled: boolean;
    slotId: string | null;
    dietType: DietType;
    isAutoDisabled: boolean;
  } | null;
  weekdayRule: { slotId: string; dietType: DietType } | null;
  dateException: DateExceptionIntent | null;
  booking: BookingRow | null;
}

export interface StudentDay {
  defaultBookingEnabled: boolean;
  leaves: LeaveRange[];
  meals: MealDayRow[];
}

export interface BookingWrite {
  slotId: string;
  dietType: DietType;
  status: BookingStatus;
  source: BookingSource;
  isOverCapacity: boolean;
  lastActorType: ActorType;
  lastActorStaffId: string | null;
  lastOverrideReason: string | null;
  cancelledAt: Date | null;
}

export interface BookingEventWrite {
  bookingId: string;
  type: Prisma.BookingEventCreateManyInput['type'];
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus | null;
  payload?: Record<string, string | null>;
  actorType: ActorType;
  actorStaffId: string | null;
  reason: string | null;
}

/** Seats in use for capacity (BR-CAP-2, ADR-0020). */
const SEAT_STATUSES = [BookingStatus.BOOKED, BookingStatus.COMPLETED, BookingStatus.NO_SHOW];
const MEAL_ORDER: Record<MealType, number> = { BREAKFAST: 0, LUNCH: 1, DINNER: 2 };
const SLOT_SELECT = {
  id: true,
  mealId: true,
  label: true,
  startMinute: true,
  endMinute: true,
  isActive: true,
} as const;
const BOOKING_INCLUDE = { slot: { select: SLOT_SELECT } } as const;

export const toDbDate = (date: BusinessDate) => new Date(`${date}T00:00:00Z`);
const fromDbDate = (date: Date): BusinessDate => date.toISOString().slice(0, 10);

type BookingWithSlot = Prisma.BookingGetPayload<{ include: typeof BOOKING_INCLUDE }>;

function toBookingRow(row: BookingWithSlot): BookingRow {
  return {
    id: row.id,
    studentId: row.studentId,
    mealId: row.mealId,
    mealDate: fromDbDate(row.mealDate),
    slot: row.slot,
    dietType: row.dietType,
    status: row.status,
    source: row.source,
    isOverCapacity: row.isOverCapacity,
    lastActorType: row.lastActorType,
    version: row.version,
  };
}

@Injectable()
export class BookingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Everything the resolver and meal cards need for one student and date (ADR-0003). */
  async loadStudentDay(
    studentId: string,
    date: BusinessDate,
    tx: TransactionClient = this.prisma,
  ): Promise<StudentDay> {
    const mealDate = toDbDate(date);
    const [student, meals, leaves] = [
      await tx.student.findUniqueOrThrow({
        where: { id: studentId },
        select: { defaultBookingEnabled: true },
      }),
      await tx.meal.findMany({
        where: { isActive: true },
        include: {
          slots: {
            where: { isActive: true, deletedAt: null },
            orderBy: { startMinute: 'asc' },
            select: SLOT_SELECT,
          },
          closureMeals: {
            where: { closure: { mealDate, status: 'ACTIVE' } },
            select: { closure: { select: { title: true } } },
          },
          mealPreferences: { where: { studentId } },
          weekdayRules: {
            where: { studentId, isActive: true, weekdays: { has: getBusinessWeekday(date) } },
          },
          dateExceptions: { where: { studentId, mealDate } },
          bookings: { where: { studentId, mealDate }, include: BOOKING_INCLUDE },
        },
      }),
      await tx.leave.findMany({
        where: {
          studentId,
          status: 'APPROVED',
          startDate: { lte: mealDate },
          endDate: { gte: mealDate },
        },
        select: { startDate: true, startMealType: true, endDate: true, endMealType: true },
      }),
    ];
    return {
      defaultBookingEnabled: student.defaultBookingEnabled,
      leaves: leaves.map((leave) => ({
        startDate: fromDbDate(leave.startDate),
        startMealType: leave.startMealType,
        endDate: fromDbDate(leave.endDate),
        endMealType: leave.endMealType,
      })),
      meals: meals.sort((a, b) => MEAL_ORDER[a.mealType] - MEAL_ORDER[b.mealType]).map(toMealDay),
    };
  }

  findSlot(
    slotId: string,
    tx: TransactionClient,
  ): Promise<(SlotRow & { mealType: MealType }) | null> {
    return tx.mealSlot
      .findFirst({
        where: { id: slotId, deletedAt: null },
        select: { ...SLOT_SELECT, meal: { select: { mealType: true } } },
      })
      .then((slot) => (slot ? { ...slot, mealType: slot.meal.mealType } : null));
  }

  async findBooking(bookingId: string, tx: TransactionClient): Promise<BookingRow | null> {
    const row = await tx.booking.findUnique({ where: { id: bookingId }, include: BOOKING_INCLUDE });
    return row ? toBookingRow(row) : null;
  }

  async findBookingFor(
    studentId: string,
    mealId: string,
    date: BusinessDate,
    tx: TransactionClient,
  ): Promise<BookingRow | null> {
    const row = await tx.booking.findUnique({
      where: { studentId_mealDate_mealId: { studentId, mealDate: toDbDate(date), mealId } },
      include: BOOKING_INCLUDE,
    });
    return row ? toBookingRow(row) : null;
  }

  /**
   * ADR-0004: serializes seat checks for one slot and date until the transaction ends. Callers
   * locking two slots lock them in slot-id order to avoid deadlocks.
   */
  async lockSlot(slotId: string, date: BusinessDate, tx: TransactionClient): Promise<void> {
    const key = `slot:${slotId}:${date}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  }

  async seatsInUse(slotId: string, date: BusinessDate, tx: TransactionClient): Promise<number> {
    return tx.booking.count({
      where: { slotId, mealDate: toDbDate(date), status: { in: SEAT_STATUSES } },
    });
  }

  async officialCapacity(
    slotId: string,
    date: BusinessDate,
    tx: TransactionClient,
  ): Promise<number> {
    const slot = await tx.mealSlot.findUniqueOrThrow({
      where: { id: slotId },
      select: {
        defaultCapacity: true,
        weekdayCapacities: {
          where: { weekday: getBusinessWeekday(date) },
          select: { capacity: true },
        },
        capacityOverrides: { where: { mealDate: toDbDate(date) }, select: { capacity: true } },
      },
    });
    return resolveOfficialCapacity({
      defaultCapacity: slot.defaultCapacity,
      weekdayCapacity: slot.weekdayCapacities[0]?.capacity ?? null,
      overrideCapacity: slot.capacityOverrides[0]?.capacity ?? null,
    });
  }

  async createBooking(
    key: { studentId: string; mealId: string; date: BusinessDate },
    write: BookingWrite,
    tx: TransactionClient,
  ): Promise<string> {
    const created = await tx.booking.create({
      data: {
        studentId: key.studentId,
        mealId: key.mealId,
        mealDate: toDbDate(key.date),
        ...write,
      },
      select: { id: true },
    });
    return created.id;
  }

  /** Returns false when someone else changed the booking first (stale `version`). */
  async updateBooking(
    id: string,
    version: number,
    write: Partial<BookingWrite>,
    tx: TransactionClient,
  ): Promise<boolean> {
    const result = await tx.booking.updateMany({
      where: { id, version },
      data: { ...write, version: { increment: 1 } },
    });
    return result.count === 1;
  }

  async saveDateException(
    key: { studentId: string; mealId: string; date: BusinessDate },
    intent: DateExceptionIntent,
    tx: TransactionClient,
  ): Promise<void> {
    const data = {
      action: intent.action,
      slotId: intent.slotId,
      dietType: intent.dietType,
      origin: intent.origin,
    };
    await tx.dateException.upsert({
      where: {
        studentId_mealDate_mealId: {
          studentId: key.studentId,
          mealDate: toDbDate(key.date),
          mealId: key.mealId,
        },
      },
      create: {
        studentId: key.studentId,
        mealId: key.mealId,
        mealDate: toDbDate(key.date),
        ...data,
      },
      update: data,
    });
  }

  async addEvent(event: BookingEventWrite, tx: TransactionClient): Promise<void> {
    await tx.bookingEvent.create({ data: { ...event, payload: event.payload ?? undefined } });
  }
}

type MealWithIntent = Prisma.MealGetPayload<{
  include: {
    slots: { select: typeof SLOT_SELECT };
    closureMeals: { select: { closure: { select: { title: true } } } };
    mealPreferences: true;
    weekdayRules: true;
    dateExceptions: true;
    bookings: { include: typeof BOOKING_INCLUDE };
  };
}>;

function toMealDay(meal: MealWithIntent): MealDayRow {
  const preference = meal.mealPreferences[0];
  const rule = meal.weekdayRules[0];
  const exception = meal.dateExceptions[0];
  const booking = meal.bookings[0];
  return {
    mealId: meal.id,
    mealType: meal.mealType,
    mealName: meal.displayName,
    serviceStartMinute: meal.serviceStartMinute,
    serviceEndMinute: meal.serviceEndMinute,
    slots: meal.slots,
    closureTitle: meal.closureMeals[0]?.closure.title ?? null,
    preference: preference
      ? {
          isEnabled: preference.isEnabled,
          slotId: preference.slotId,
          dietType: preference.dietType,
          isAutoDisabled: preference.autoDisabledAt !== null,
        }
      : null,
    weekdayRule: rule ? { slotId: rule.slotId, dietType: rule.dietType } : null,
    dateException: exception
      ? {
          action: exception.action,
          slotId: exception.slotId,
          dietType: exception.dietType,
          origin: exception.origin,
        }
      : null,
    booking: booking ? toBookingRow(booking) : null,
  };
}
