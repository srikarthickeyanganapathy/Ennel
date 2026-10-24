import { Injectable } from '@nestjs/common';
import {
  addBusinessDays,
  type AdminClosure,
  type ClosureImpact,
  type closureImpactQuerySchema,
  type closureListQuerySchema,
  toBusinessDate,
} from '@ennel/shared';
import { type z } from 'zod';
import { Clock } from '../../../../infrastructure/clock/clock';
import { AdminClosuresRepository } from '../repositories/admin-closures.repository';

/** Closure list and the "how many bookings would this cancel" preview (Admin §F). */
@Injectable()
export class ClosureQueriesService {
  constructor(
    private readonly closures: AdminClosuresRepository,
    private readonly clock: Clock,
  ) {}

  /** Defaults to the last 30 days and everything ahead. */
  list(query: z.output<typeof closureListQuerySchema>): Promise<AdminClosure[]> {
    const from = query.from ?? addBusinessDays(toBusinessDate(this.clock.now()), -30);
    return this.closures.list(from, query.to, query.includeRemoved);
  }

  async impact(query: z.output<typeof closureImpactQuerySchema>): Promise<ClosureImpact> {
    const mealIds = await this.closures.mealIds(query.mealTypes);
    const counts = await this.closures.countBooked(query.date, [...mealIds.values()]);
    const meals = query.mealTypes.map((mealType) => {
      const mealId = mealIds.get(mealType);
      return { mealType, bookedCount: mealId ? (counts.get(mealId) ?? 0) : 0 };
    });
    return { meals, totalBooked: meals.reduce((sum, meal) => sum + meal.bookedCount, 0) };
  }
}
