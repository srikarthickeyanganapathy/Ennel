import { Injectable } from '@nestjs/common';
import { ErrorCode, type MealPreferenceInput } from '@ennel/shared';
import { AppError } from '../../../common/errors/app-error';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';
import { ListMealsService } from '../../mess-config/services/list-meals.service';
import { validateMealPreferences } from '../domain/validate-meal-preferences';
import { MealPreferenceRepository } from '../repositories/meal-preference.repository';

/**
 * Saves Default Booking preferences (Spec §3 Screen 7, §8). Runs inside the caller's
 * transaction so onboarding commits profile and preferences together.
 */
@Injectable()
export class SaveMealPreferencesService {
  constructor(
    private readonly meals: ListMealsService,
    private readonly preferences: MealPreferenceRepository,
  ) {}

  async execute(
    studentId: string,
    inputs: MealPreferenceInput[],
    tx?: TransactionClient,
  ): Promise<void> {
    const meals = await this.meals.execute();
    const result = validateMealPreferences(
      inputs,
      meals.map((meal) => ({
        mealId: meal.id,
        mealType: meal.mealType,
        activeSlotIds: meal.slots.map((slot) => slot.id),
      })),
    );
    if (!result.ok) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, 'Check your meal preferences.', {
        issues: result.issues.map((issue) => ({
          path: `mealPreferences.${issue.mealType}`,
          message: issue.message,
        })),
      });
    }
    await this.preferences.saveAll(studentId, result.preferences, tx);
  }
}
