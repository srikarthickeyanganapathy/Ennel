import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';
import { type DietType, type MealType } from '@ennel/shared';
import { type ValidatedMealPreference } from '../domain/validate-meal-preferences';

export interface StoredPreferences {
  defaultBookingEnabled: boolean;
  meals: {
    mealType: MealType;
    isEnabled: boolean;
    slotId: string | null;
    dietType: DietType;
    isAutoDisabled: boolean;
  }[];
}

export abstract class MealPreferenceRepository {
  /** Upserts one row per meal. No-show auto-disable fields are left untouched (BR-NS-5). */
  abstract saveAll(
    studentId: string,
    preferences: ValidatedMealPreference[],
    tx?: TransactionClient,
  ): Promise<void>;
  abstract load(studentId: string, tx?: TransactionClient): Promise<StoredPreferences>;
  /** The overall Default Booking switch (Spec §8.1); meal choices are kept either way. */
  abstract setOverall(studentId: string, isEnabled: boolean, tx: TransactionClient): Promise<void>;
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

  async load(studentId: string, tx: TransactionClient = this.prisma): Promise<StoredPreferences> {
    const student = await tx.student.findUniqueOrThrow({
      where: { id: studentId },
      select: {
        defaultBookingEnabled: true,
        mealPreferences: {
          select: {
            isEnabled: true,
            slotId: true,
            dietType: true,
            autoDisabledAt: true,
            meal: { select: { mealType: true } },
          },
        },
      },
    });
    return {
      defaultBookingEnabled: student.defaultBookingEnabled,
      meals: student.mealPreferences.map((row) => ({
        mealType: row.meal.mealType,
        isEnabled: row.isEnabled,
        slotId: row.slotId,
        dietType: row.dietType,
        isAutoDisabled: row.autoDisabledAt !== null,
      })),
    };
  }

  async setOverall(studentId: string, isEnabled: boolean, tx: TransactionClient): Promise<void> {
    await tx.student.update({
      where: { id: studentId },
      data: { defaultBookingEnabled: isEnabled },
    });
  }
}
