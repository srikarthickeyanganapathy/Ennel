import { Injectable } from '@nestjs/common';
import { BookingStatus, type BusinessDate, type DietType, type MealType } from '@ennel/shared';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

const toDbDate = (date: BusinessDate) => new Date(`${date}T00:00:00Z`);
const fromDbDate = (date: Date): BusinessDate => date.toISOString().slice(0, 10);
const SEAT_STATUSES = [BookingStatus.BOOKED, BookingStatus.COMPLETED, BookingStatus.NO_SHOW];

export interface ForecastMeal {
  id: string;
  mealType: MealType;
  mealName: string;
  slots: { slotId: string; label: string; startMinute: number; isActive: boolean }[];
}

export interface SeatRow {
  date: BusinessDate;
  mealId: string;
  slotId: string;
  dietType: DietType;
  count: number;
}

/** Read-only numbers for the kitchen forecast (Admin §N). */
@Injectable()
export class AdminForecastingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async meals(): Promise<ForecastMeal[]> {
    const rows = await this.prisma.meal.findMany({
      where: { isActive: true },
      orderBy: { serviceStartMinute: 'asc' },
      select: {
        id: true,
        mealType: true,
        displayName: true,
        slots: {
          where: { deletedAt: null },
          orderBy: { startMinute: 'asc' },
          select: { id: true, label: true, startMinute: true, isActive: true },
        },
      },
    });
    return rows.map((meal) => ({
      id: meal.id,
      mealType: meal.mealType,
      mealName: meal.displayName,
      slots: meal.slots.map((slot) => ({
        slotId: slot.id,
        label: slot.label,
        startMinute: slot.startMinute,
        isActive: slot.isActive,
      })),
    }));
  }

  async seats(from: BusinessDate, to: BusinessDate): Promise<SeatRow[]> {
    const rows = await this.prisma.booking.groupBy({
      by: ['mealDate', 'mealId', 'slotId', 'dietType'],
      where: {
        mealDate: { gte: toDbDate(from), lte: toDbDate(to) },
        status: { in: SEAT_STATUSES },
      },
      _count: { _all: true },
    });
    return rows.map((row) => ({
      date: fromDbDate(row.mealDate),
      mealId: row.mealId,
      slotId: row.slotId,
      dietType: row.dietType,
      count: row._count._all,
    }));
  }

  /** Closure titles keyed `mealId#date`. */
  async closures(from: BusinessDate, to: BusinessDate): Promise<Map<string, string>> {
    const rows = await this.prisma.messClosure.findMany({
      where: { status: 'ACTIVE', mealDate: { gte: toDbDate(from), lte: toDbDate(to) } },
      select: { title: true, mealDate: true, meals: { select: { mealId: true } } },
    });
    return new Map(
      rows.flatMap((closure) =>
        closure.meals.map(
          (meal) => [`${meal.mealId}#${fromDbDate(closure.mealDate)}`, closure.title] as const,
        ),
      ),
    );
  }
}
