import { Injectable } from '@nestjs/common';
import { BookingStatus, type BusinessDate, getBusinessWeekday, type MealType } from '@ennel/shared';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { resolveOfficialCapacity } from '../../mess-config/domain/capacity';
import { type SlotCount } from '../domain/slot-availability';

export interface MealDaySnapshot {
  mealName: string;
  serviceStartMinute: number;
  serviceEndMinute: number;
  closureTitle: string | null;
  slots: SlotCount[];
}

export abstract class SlotAvailabilityRepository {
  /** Null when the meal is not configured or not active. */
  abstract loadMealDay(mealType: MealType, date: BusinessDate): Promise<MealDaySnapshot | null>;
}

/** Seats in use: future bookings plus bookings that already happened (BR-CAP-2). */
const SEAT_STATUSES = [BookingStatus.BOOKED, BookingStatus.COMPLETED, BookingStatus.NO_SHOW];

const toDbDate = (date: BusinessDate) => new Date(`${date}T00:00:00Z`);

@Injectable()
export class PrismaSlotAvailabilityRepository extends SlotAvailabilityRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async loadMealDay(mealType: MealType, date: BusinessDate): Promise<MealDaySnapshot | null> {
    const mealDate = toDbDate(date);
    const meal = await this.prisma.meal.findFirst({
      where: { mealType, isActive: true },
      include: {
        slots: {
          where: { isActive: true, deletedAt: null },
          orderBy: [{ startMinute: 'asc' }, { sortOrder: 'asc' }],
          include: {
            weekdayCapacities: { where: { weekday: getBusinessWeekday(date) } },
            capacityOverrides: { where: { mealDate } },
          },
        },
      },
    });
    if (!meal) return null;

    const [counts, closure] = await Promise.all([
      this.prisma.booking.groupBy({
        by: ['slotId'],
        where: { mealDate, mealId: meal.id, status: { in: SEAT_STATUSES } },
        _count: { _all: true },
      }),
      this.prisma.messClosure.findFirst({
        where: { mealDate, status: 'ACTIVE', meals: { some: { mealId: meal.id } } },
        select: { title: true },
      }),
    ]);
    const booked = new Map(counts.map((row) => [row.slotId, row._count._all]));

    return {
      mealName: meal.displayName,
      serviceStartMinute: meal.serviceStartMinute,
      serviceEndMinute: meal.serviceEndMinute,
      closureTitle: closure?.title ?? null,
      slots: meal.slots.map((slot) => ({
        slotId: slot.id,
        label: slot.label,
        startMinute: slot.startMinute,
        endMinute: slot.endMinute,
        officialCapacity: resolveOfficialCapacity({
          defaultCapacity: slot.defaultCapacity,
          weekdayCapacity: slot.weekdayCapacities[0]?.capacity ?? null,
          overrideCapacity: slot.capacityOverrides[0]?.capacity ?? null,
        }),
        bookedCount: booked.get(slot.id) ?? 0,
      })),
    };
  }
}
