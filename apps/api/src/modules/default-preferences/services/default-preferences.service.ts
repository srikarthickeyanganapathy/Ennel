import { Injectable } from '@nestjs/common';
import {
  addBusinessDays,
  type DefaultMealSettings,
  type DefaultPreferences,
  type MealConfig,
  type MealPreferenceInput,
  type MealType,
  type SaveDefaultPreferencesRequest,
  type SaveDefaultPreferencesResponse,
  toBusinessDate,
  toMinuteOfDay,
  type UpdateMealPreferenceRequest,
} from '@ennel/shared';
import { Clock } from '../../../infrastructure/clock/clock';
import { TransactionRunner } from '../../../infrastructure/database/transaction-runner';
import { GetMessPolicyService } from '../../mess-config/services/get-mess-policy.service';
import { ListMealsService } from '../../mess-config/services/list-meals.service';
import { computeSlotAvailability } from '../../slots/domain/slot-availability';
import { SlotAvailabilityRepository } from '../../slots/repositories/slot-availability.repository';
import { diffPreferences, type PreferenceState } from '../domain/preference-changes';
import {
  MealPreferenceRepository,
  type StoredPreferences,
} from '../repositories/meal-preference.repository';
import { SaveMealPreferencesService } from './save-meal-preferences.service';
import { SyncStudentBookingsService } from './sync-student-bookings.service';

/** The student Default Booking page (Spec §8, BR-BOOK-5/6, BR-DEF). */
@Injectable()
export class DefaultPreferencesService {
  constructor(
    private readonly preferences: MealPreferenceRepository,
    private readonly save: SaveMealPreferencesService,
    private readonly sync: SyncStudentBookingsService,
    private readonly meals: ListMealsService,
    private readonly slots: SlotAvailabilityRepository,
    private readonly policies: GetMessPolicyService,
    private readonly transactions: TransactionRunner,
    private readonly clock: Clock,
  ) {}

  async get(studentId: string): Promise<DefaultPreferences> {
    const [stored, meals, policy] = [
      await this.preferences.load(studentId),
      await this.meals.execute(),
      await this.policies.execute(),
    ];
    const now = this.clock.now();
    const nextDate = addBusinessDays(toBusinessDate(now), 1);
    const settings: DefaultMealSettings[] = [];
    for (const meal of meals) {
      const pref = stored.meals.find((row) => row.mealType === meal.mealType);
      settings.push({
        mealType: meal.mealType,
        mealName: meal.displayName,
        serviceStartMinute: meal.serviceStartMinute,
        serviceEndMinute: meal.serviceEndMinute,
        isEnabled: pref?.isEnabled ?? false,
        slotId: pref?.slotId ?? null,
        slotLabel: meal.slots.find((slot) => slot.id === pref?.slotId)?.label ?? null,
        dietType: pref?.dietType ?? 'VEG',
        isAutoDisabled: pref?.isAutoDisabled ?? false,
        slots: meal.slots.map((slot) => ({
          slotId: slot.id,
          label: slot.label,
          startMinute: slot.startMinute,
          endMinute: slot.endMinute,
        })),
        nextDate,
        nextDateStatus: pref?.slotId
          ? await this.statusOn(meal.mealType, pref.slotId, nextDate, now)
          : null,
      });
    }
    return {
      defaultBookingEnabled: stored.defaultBookingEnabled,
      fallbackPolicy: policy.defaultSlotFullFallback,
      meals: settings,
    };
  }

  /** Spec §8.3: the overall switch and all meals together, with a summary of what changed. */
  saveAll(
    studentId: string,
    request: SaveDefaultPreferencesRequest,
  ): Promise<SaveDefaultPreferencesResponse> {
    return this.apply(studentId, request.defaultBookingEnabled, request.meals);
  }

  /** Spec §8.2: one meal only; the other meals and the overall switch stay as they are. */
  async updateMeal(
    studentId: string,
    mealType: MealType,
    patch: UpdateMealPreferenceRequest,
  ): Promise<SaveDefaultPreferencesResponse> {
    const stored = await this.preferences.load(studentId);
    const current = stored.meals.find((row) => row.mealType === mealType);
    const input: MealPreferenceInput = {
      mealType,
      isEnabled: patch.isEnabled ?? current?.isEnabled ?? false,
      slotId: patch.slotId !== undefined ? patch.slotId : (current?.slotId ?? null),
      dietType: patch.dietType ?? current?.dietType ?? 'VEG',
    };
    return this.apply(studentId, stored.defaultBookingEnabled, [input]);
  }

  private async apply(
    studentId: string,
    defaultBookingEnabled: boolean,
    inputs: MealPreferenceInput[],
  ): Promise<SaveDefaultPreferencesResponse> {
    const meals = await this.meals.execute();
    const { before, after, bookingsUpdated } = await this.transactions.run(
      async (tx) => {
        const previous = await this.preferences.load(studentId, tx);
        await this.save.execute(studentId, inputs, tx);
        await this.preferences.setOverall(studentId, defaultBookingEnabled, tx);
        const updated = await this.sync.execute(studentId, tx);
        return {
          before: previous,
          after: await this.preferences.load(studentId, tx),
          bookingsUpdated: updated,
        };
      },
      { timeoutMs: 30_000 },
    );
    return {
      preferences: await this.get(studentId),
      changes: diffPreferences(toState(before), toState(after), slotLabels(meals)),
      bookingsUpdated,
    };
  }

  /** How busy the preferred slot is on the next booked date (Spec §8.2 availability status). */
  private async statusOn(
    mealType: MealType,
    slotId: string,
    date: string,
    now: Date,
  ): Promise<DefaultMealSettings['nextDateStatus']> {
    const day = await this.slots.loadMealDay(mealType, date);
    if (!day) return null;
    const policy = await this.policies.execute();
    const rows = computeSlotAvailability(day.slots, {
      date,
      today: toBusinessDate(now),
      nowMinute: toMinuteOfDay(now),
      isClosed: day.closureTitle !== null,
      policy,
    });
    return rows.find((row) => row.slotId === slotId)?.status ?? null;
  }
}

function toState(stored: StoredPreferences): PreferenceState {
  return {
    defaultBookingEnabled: stored.defaultBookingEnabled,
    meals: Object.fromEntries(
      stored.meals.map(({ mealType, isEnabled, slotId, dietType }) => [
        mealType,
        { isEnabled, slotId, dietType },
      ]),
    ),
  };
}

function slotLabels(meals: MealConfig[]): Map<string, string> {
  return new Map(meals.flatMap((meal) => meal.slots.map((slot) => [slot.id, slot.label] as const)));
}
