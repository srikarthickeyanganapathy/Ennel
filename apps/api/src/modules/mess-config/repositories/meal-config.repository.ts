import { Injectable } from '@nestjs/common';
import { type MealConfig } from '@ennel/shared';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export abstract class MealConfigRepository {
  /** Active meals with their active, non-deleted slots in serving order. */
  abstract listActive(): Promise<MealConfig[]>;
}

const MEAL_ORDER = { BREAKFAST: 0, LUNCH: 1, DINNER: 2 } as const;

@Injectable()
export class PrismaMealConfigRepository extends MealConfigRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async listActive(): Promise<MealConfig[]> {
    const meals = await this.prisma.meal.findMany({
      where: { isActive: true },
      include: {
        slots: {
          where: { isActive: true, deletedAt: null },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, label: true, startMinute: true, endMinute: true, sortOrder: true },
        },
      },
    });
    return meals
      .sort((a, b) => MEAL_ORDER[a.mealType] - MEAL_ORDER[b.mealType])
      .map((meal) => ({
        id: meal.id,
        mealType: meal.mealType,
        displayName: meal.displayName,
        serviceStartMinute: meal.serviceStartMinute,
        serviceEndMinute: meal.serviceEndMinute,
        slots: meal.slots,
      }));
  }
}
