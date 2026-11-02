import { Injectable } from '@nestjs/common';
import {
  addBusinessDays,
  type BusinessDate,
  type Forecast,
  type ForecastMealDay,
  getBusinessWeekday,
  toBusinessDate,
} from '@ennel/shared';
import { Clock } from '../../../../infrastructure/clock/clock';
import { forecastMealDay, wastedPlates } from '../../../forecasting/domain/kitchen-forecast';
import { estimateShowUpRate } from '../../../forecasting/domain/show-up-rate';
import { type MessPolicy } from '../../../mess-config/domain/mess-policy';
import { GetMessPolicyService } from '../../../mess-config/services/get-mess-policy.service';
import {
  AdminDashboardRepository,
  type MealDayCounts,
} from '../../admin-dashboard/repositories/admin-dashboard.repository';
import {
  AdminForecastingRepository,
  type ForecastMeal,
  type SeatRow,
} from '../repositories/admin-forecasting.repository';

const TREND_DAYS = 30;
const WASTE_WEEKS = 4;

interface MealDayContext {
  date: BusinessDate;
  today: BusinessDate;
  now: Date;
  policy: MessPolicy;
  history: MealDayCounts[];
  seats: SeatRow[];
  closures: Map<string, string>;
}

/** Admin §N: booked and expected plates per meal, slot and diet, with the recent history. */
@Injectable()
export class GetForecastService {
  constructor(
    private readonly forecasting: AdminForecastingRepository,
    private readonly dashboard: AdminDashboardRepository,
    private readonly policies: GetMessPolicyService,
    private readonly clock: Clock,
  ) {}

  async execute(from: BusinessDate, days: number): Promise<Forecast> {
    const now = this.clock.now();
    const today = toBusinessDate(now);
    const to = addBusinessDays(from, days - 1);
    const policy = await this.policies.execute();
    // Lookback counts days with data, so read further back to find enough of them.
    const earliest = from < today ? from : today;
    const historyFrom = addBusinessDays(earliest, -policy.forecastLookbackDays * 3);
    const trendFrom = addBusinessDays(today, -Math.max(TREND_DAYS, WASTE_WEEKS * 7 + 7));
    const [meals, seats, closures, history] = await Promise.all([
      this.forecasting.meals(),
      this.forecasting.seats(from, to),
      this.forecasting.closures(from, to),
      this.dashboard.mealDayCounts(historyFrom < trendFrom ? historyFrom : trendFrom, today),
    ]);
    const dates = Array.from({ length: days }, (_, offset) => addBusinessDays(from, offset));
    const context = { today, now, policy, history, seats, closures };
    return {
      from,
      days,
      today,
      lookbackDays: policy.forecastLookbackDays,
      generatedAt: now.toISOString(),
      meals: dates.flatMap((date) => meals.map((meal) => this.mealDay(meal, { ...context, date }))),
      trend: trendOf(history, today),
      wasteWeeks: wasteWeeksOf(history, today),
    };
  }

  private mealDay(meal: ForecastMeal, context: MealDayContext): ForecastMealDay {
    const { date, today, seats, closures, history, policy, now } = context;
    const dayKey = (row: { date: BusinessDate; mealId: string }) =>
      row.mealId === meal.id && row.date === date;
    const daySeats = seats.filter(dayKey);
    // Only finished days count: today's attendance is still coming in (BR-FC-1).
    const before = date < today ? date : today;
    const estimate = estimateShowUpRate(
      history
        .filter((entry) => entry.mealId === meal.id && entry.date < before)
        .map((entry) => ({
          booked: entry.booked,
          attended: entry.attended,
          hasAttendanceData: entry.attended + entry.noShows > 0,
        })),
      policy.forecastLookbackDays,
    );
    return forecastMealDay({
      date,
      mealType: meal.mealType,
      mealName: meal.mealName,
      closureTitle: closures.get(`${meal.id}#${date}`) ?? null,
      // A disabled slot still shows while students are booked on it.
      slots: meal.slots.filter(
        (slot) => slot.isActive || daySeats.some((seat) => seat.slotId === slot.slotId),
      ),
      seats: daySeats,
      estimate,
      cancellationCutoffMinutes: policy.cancellationCutoffMinutes,
      now,
    });
  }
}

function trendOf(history: readonly MealDayCounts[], today: BusinessDate): Forecast['trend'] {
  const from = addBusinessDays(today, -TREND_DAYS);
  const days = new Map<BusinessDate, { booked: number; served: number }>();
  for (const entry of history) {
    if (entry.date < from || entry.date >= today) continue;
    const day = days.get(entry.date) ?? { booked: 0, served: 0 };
    days.set(entry.date, {
      booked: day.booked + entry.booked,
      served: day.served + entry.attended,
    });
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, day]) => ({ date, ...day }));
}

/**
 * ADR-0029: the last complete weeks. A day without attendance data is skipped, because a missing
 * feed is not a kitchen that wasted every plate (BR-FC-2).
 */
function wasteWeeksOf(
  history: readonly MealDayCounts[],
  today: BusinessDate,
): Forecast['wasteWeeks'] {
  const thisMonday = addBusinessDays(today, -((getBusinessWeekday(today) + 6) % 7));
  return Array.from({ length: WASTE_WEEKS }, (_, index) => {
    const weekStart = addBusinessDays(thisMonday, -7 * (WASTE_WEEKS - index));
    const weekEnd = addBusinessDays(weekStart, 6);
    const plates = history
      .filter(
        (entry) =>
          entry.date >= weekStart && entry.date <= weekEnd && entry.attended + entry.noShows > 0,
      )
      .reduce(
        (sum, entry) =>
          sum + wastedPlates({ booked: entry.attended + entry.noShows, served: entry.attended }),
        0,
      );
    return { weekStart, plates };
  });
}
