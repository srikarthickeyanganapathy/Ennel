import { Injectable } from '@nestjs/common';
import {
  addBusinessDays,
  type BusinessDate,
  type Dashboard,
  type DashboardMeal,
  ErrorCode,
  type MealType,
  toBusinessDate,
  toMinuteOfDay,
  type TrendDay,
} from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';
import { Clock } from '../../../../infrastructure/clock/clock';
import { type MessPolicy } from '../../../mess-config/domain/mess-policy';
import { GetMessPolicyService } from '../../../mess-config/services/get-mess-policy.service';
import { estimateShowUpRate, expectedPlates } from '../../../forecasting/domain/show-up-rate';
import { computeSlotAvailability } from '../../../slots/domain/slot-availability';
import { SlotAvailabilityRepository } from '../../../slots/repositories/slot-availability.repository';
import { StaffPermissionsService } from '../../rbac/services/staff-permissions.service';
import {
  AdminDashboardRepository,
  type DietCount,
  type MealDayCounts,
} from '../repositories/admin-dashboard.repository';

const MEAL_ORDER: MealType[] = ['BREAKFAST', 'LUNCH', 'DINNER'];
const TREND_DAYS = 7;

interface MealContext {
  date: BusinessDate;
  today: BusinessDate;
  now: Date;
  policy: MessPolicy;
  diets: DietCount[];
  history: MealDayCounts[];
}

/** Admin §C dashboard for today or a chosen date. */
@Injectable()
export class GetDashboardService {
  constructor(
    private readonly dashboard: AdminDashboardRepository,
    private readonly slots: SlotAvailabilityRepository,
    private readonly policies: GetMessPolicyService,
    private readonly permissions: StaffPermissionsService,
    private readonly clock: Clock,
  ) {}

  async execute(staffId: string, requestedDate: BusinessDate | undefined): Promise<Dashboard> {
    const now = this.clock.now();
    const today = toBusinessDate(now);
    const date = requestedDate ?? today;
    const canChooseDate = await this.permissions.hasAll(staffId, ['dashboard:read']);
    if (date !== today && !canChooseDate) {
      throw new AppError(ErrorCode.PERMISSION_DENIED, "Your role can view today's dashboard only.");
    }
    const policy = await this.policies.execute();
    const historyFrom = addBusinessDays(date, -policy.forecastLookbackDays * 3);
    const [diets, history, meals, pending, trend] = await Promise.all([
      this.dashboard.dietCounts(date),
      this.dashboard.mealDayCounts(historyFrom, date),
      this.dashboard.activeMeals(),
      this.dashboard.pendingWork(),
      this.trend(date),
    ]);
    const context: MealContext = { date, today, now, policy, diets, history };
    const ordered = MEAL_ORDER.flatMap((type) => meals.filter((meal) => meal.mealType === type));
    const cards: DashboardMeal[] = [];
    for (const meal of ordered) {
      const card = await this.mealCard(meal.id, meal.mealType, context);
      if (card) cards.push(card);
    }
    return {
      date,
      today,
      canChooseDate,
      generatedAt: now.toISOString(),
      meals: cards,
      pending,
      trend,
    };
  }

  private async mealCard(
    mealId: string,
    mealType: MealType,
    context: MealContext,
  ): Promise<DashboardMeal | null> {
    const day = await this.slots.loadMealDay(mealType, context.date);
    if (!day) return null;
    const slots = computeSlotAvailability(day.slots, {
      date: context.date,
      today: context.today,
      nowMinute: toMinuteOfDay(context.now),
      isClosed: day.closureTitle !== null,
      policy: context.policy,
    });
    // Past days only: today's attendance is still coming in (BR-FC-1).
    const past = context.history.filter(
      (entry) => entry.mealId === mealId && entry.date < context.date,
    );
    const estimate = estimateShowUpRate(
      past.map((entry) => ({
        booked: entry.booked,
        attended: entry.attended,
        hasAttendanceData: entry.attended + entry.noShows > 0,
      })),
      context.policy.forecastLookbackDays,
    );
    const booked = slots.reduce((sum, slot) => sum + slot.bookedCount, 0);
    const diet = (type: 'VEG' | 'NON_VEG') =>
      context.diets.find((row) => row.mealId === mealId && row.dietType === type)?.count ?? 0;
    return {
      mealType,
      mealName: day.mealName,
      closureTitle: day.closureTitle,
      booked,
      expected: expectedPlates(booked, estimate),
      showUpRatePct: Math.round(estimate.rate * 100),
      isExpectedLowConfidence: estimate.isLowConfidence,
      attended:
        context.history.find((entry) => entry.mealId === mealId && entry.date === context.date)
          ?.attended ?? 0,
      veg: diet('VEG'),
      nonVeg: diet('NON_VEG'),
      overCapacitySlotCount: slots.filter((slot) => slot.status === 'OVER_CAPACITY').length,
      slots: slots.map(
        ({
          slotId,
          label,
          officialCapacity,
          bookedCount,
          occupancyPct,
          status,
          isRecommended,
        }) => ({
          slotId,
          label,
          officialCapacity,
          bookedCount,
          occupancyPct,
          status,
          isRecommended,
        }),
      ),
    };
  }

  private async trend(date: BusinessDate): Promise<TrendDay[]> {
    const from = addBusinessDays(date, -(TREND_DAYS - 1));
    const counts = await this.dashboard.dayStatusCounts(from, date);
    return Array.from({ length: TREND_DAYS }, (_, index) => {
      const day = addBusinessDays(from, index);
      const found = counts.find((entry) => entry.date === day) ?? {
        booked: 0,
        completed: 0,
        noShows: 0,
      };
      const settled = found.completed + found.noShows;
      return {
        date: day,
        booked: found.booked,
        completed: found.completed,
        noShows: found.noShows,
        noShowRatePct: settled > 0 ? Math.round((found.noShows / settled) * 100) : null,
      };
    });
  }
}
