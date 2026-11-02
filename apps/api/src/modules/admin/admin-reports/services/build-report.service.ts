import { Injectable } from '@nestjs/common';
import {
  addBusinessDays,
  type AdminReport,
  type BusinessDate,
  ErrorCode,
  REPORT_MAX_DAYS,
  type ReportFilters,
  toBusinessDate,
} from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';
import { Clock } from '../../../../infrastructure/clock/clock';
import {
  averageResolutionHours,
  noShowRatePct,
  reportByMeal,
  reportCancellations,
  reportSeries,
  reportSlots,
  tallyOf,
  tallyTotal,
  wasteOf,
} from '../domain/report-summary';
import { AdminReportsRepository, type HostelCount } from '../repositories/admin-reports.repository';

export function daysInRange(from: BusinessDate, to: BusinessDate): number {
  return (
    Math.round(
      (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) /
        86_400_000,
    ) + 1
  );
}

/** Admin §O report for a date range, meal and hostel. Definitions are in ADR-0029. */
@Injectable()
export class BuildReportService {
  constructor(
    private readonly reports: AdminReportsRepository,
    private readonly clock: Clock,
  ) {}

  assertRange(filters: Pick<ReportFilters, 'from' | 'to'>): void {
    const today = toBusinessDate(this.clock.now());
    if (filters.to > today) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, 'Reports cover past days and today only.');
    }
    if (daysInRange(filters.from, filters.to) > REPORT_MAX_DAYS) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        `Choose a range of ${REPORT_MAX_DAYS} days or fewer.`,
      );
    }
  }

  async execute(filters: ReportFilters): Promise<AdminReport> {
    this.assertRange(filters);
    const { from, to, groupBy, hostelId } = filters;
    const allMeals = await this.reports.meals();
    const meals = allMeals.filter(
      (meal) => !filters.mealType || meal.mealType === filters.mealType,
    );
    const mealIds = meals.map((meal) => meal.id);
    const length = daysInRange(from, to);
    const previousTo = addBusinessDays(from, -1);
    const previousFrom = addBusinessDays(previousTo, -(length - 1));
    const [rows, previous, hostels, cancelled, slots, closedMeals, leaves, complaints, choices] =
      await Promise.all([
        this.reports.bookingCounts(from, to, filters, mealIds),
        this.reports.bookingCounts(previousFrom, previousTo, filters, mealIds),
        this.reports.hostelCounts(from, to, filters, mealIds),
        this.reports.cancelledBookings(from, to, filters, mealIds),
        this.reports.slots(from, to, meals),
        this.reports.closedMeals(from, to),
        this.reports.leaveCounts(filters),
        this.reports.complaintCounts(filters),
        this.reports.hostels(),
      ]);
    const tally = tallyOf(rows);
    const previousTally = tallyOf(previous);
    return {
      from,
      to,
      groupBy,
      generatedAt: this.clock.now().toISOString(),
      hostels: choices,
      kpis: {
        ...tally,
        total: tallyTotal(tally),
        noShowRatePct: noShowRatePct(tally),
        previousNoShowRatePct: noShowRatePct(previousTally),
        wastePlates: wasteOf(tally),
        previousWastePlates: wasteOf(previousTally),
      },
      byMeal: reportByMeal(rows, meals),
      series: reportSeries(rows, groupBy),
      byHostel: hostelRows(hostels),
      slots: reportSlots(rows, slots, {
        from,
        to,
        closedMeals,
        hideUtilization: hostelId !== undefined,
      }),
      cancellations: reportCancellations(cancelled),
      leaves,
      complaints: {
        total: complaints.byCategory.reduce((sum, row) => sum + row.count, 0),
        byCategory: [...complaints.byCategory].sort((a, b) => b.count - a.count),
        byStatus: complaints.byStatus,
        averageResolutionHours: averageResolutionHours(complaints.resolved),
      },
    };
  }
}

function hostelRows(counts: readonly HostelCount[]): AdminReport['byHostel'] {
  const hostels = new Map<string, HostelCount[]>();
  for (const row of counts) {
    const key = row.hostelId ?? 'none';
    hostels.set(key, [...(hostels.get(key) ?? []), row]);
  }
  return [...hostels.values()]
    .map((rows) => {
      const tally = tallyOf(rows);
      return {
        hostelId: rows[0]?.hostelId ?? null,
        hostelName: rows[0]?.hostelName ?? 'No hostel on file',
        served: tally.served,
        noShows: tally.noShows,
        noShowRatePct: noShowRatePct(tally),
      };
    })
    .sort((a, b) => a.hostelName.localeCompare(b.hostelName));
}
