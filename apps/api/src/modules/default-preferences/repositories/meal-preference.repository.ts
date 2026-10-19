import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';
import { type ValidatedMealPreference } from '../domain/validate-meal-preferences';

export abstract class MealPreferenceRepository {
  /** Upserts one row per meal. No-show auto-disable fields are left untouched (BR-NS-5). */
  abstract saveAll(
    studentId: string,
    preferences: ValidatedMealPreference[],
    tx?: TransactionClient,
  ): Promise<void>;
}

@Injectable()
export class PrismaMealPreferenceRepository extends MealPreferenceRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async saveAll(
    studentId: string,
    preferences: ValidatedMealPreference[],
    tx: TransactionClient = this.prisma,
  ): Promise<void> {
    for (const preference of preferences) {
      const values = {
        isEnabled: preference.isEnabled,
        slotId: preference.slotId,
        dietType: preference.dietType,
      };
      await tx.mealPreference.upsert({
        where: { studentId_mealId: { studentId, mealId: preference.mealId } },
        create: { studentId, mealId: preference.mealId, ...values },
        update: { ...values, version: { increment: 1 } },
      });
    }
  }
}
