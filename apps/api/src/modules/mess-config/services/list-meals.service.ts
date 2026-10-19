import { Injectable } from '@nestjs/common';
import { type MealConfig } from '@ennel/shared';
import { MealConfigRepository } from '../repositories/meal-config.repository';

/** Meals and slots as configured by staff (Rule 1: never hard-coded). */
@Injectable()
export class ListMealsService {
  constructor(private readonly meals: MealConfigRepository) {}

  execute(): Promise<MealConfig[]> {
    return this.meals.listActive();
  }
}
