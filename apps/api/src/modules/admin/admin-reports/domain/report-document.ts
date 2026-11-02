import { type AdminReport, type CancellationBucket, formatBusinessDateLabel } from '@ennel/shared';
import { type ReportDocument } from '../../../../common/files/report-exporter';

const PERIOD_NAMES = { day: 'Day', week: 'Week starting', month: 'Month starting' } as const;
const BUCKET_NAMES: Record<CancellationBucket, string> = {
  UNDER_1_HOUR: 'Under 1 hour',
  HOURS_1_TO_6: '1 to 6 hours',
  HOURS_6_TO_24: '6 to 24 hours',
  OVER_24_HOURS: 'Over 24 hours',
};

const percent = (value: number | null) => (value === null ? '' : `${value}%`);

/** Admin §O: the same report on screen and in every export format. */
export function reportDocument(report: AdminReport): ReportDocument {
  const { kpis } = report;
  return {
    fileName: `ennel-report-${report.from}-to-${report.to}`,
    title: 'ENNEL report',
    subtitle: `${formatBusinessDateLabel(report.from)} to ${formatBusinessDateLabel(report.to)}`,
    tables: [
      {
        title: 'Summary',
        note: 'Waste estimate = plates booked but not attended on finished meals.',
        columns: ['Measure', 'Value'],
        rows: [
          ['Total bookings', kpis.total],
          ['Meals served', kpis.served],
          ['Cancelled', kpis.cancelled],
          ['No-shows', kpis.noShows],
          ['Not finished yet', kpis.pending],
          ['No-show rate', percent(kpis.noShowRatePct)],
          ['Waste estimate (plates)', kpis.wastePlates],
        ],
      },
      {
        title: 'By meal',
        columns: [
          'Meal',
          'Served',
          'Cancelled',
          'No-show',
          'Not finished',
          'Total',
          'No-show rate',
        ],
        rows: report.byMeal.map((meal) => [
          meal.mealName,
          meal.served,
          meal.cancelled,
          meal.noShows,
          meal.pending,
          meal.total,
          percent(meal.noShowRatePct),
        ]),
      },
      {
        title: 'Over time',
        columns: [PERIOD_NAMES[report.groupBy], 'Booked', 'Served', 'No-shows', 'Waste (plates)'],
        rows: report.series.map((row) => [
          formatBusinessDateLabel(row.period),
          row.booked,
          row.served,
          row.noShows,
          row.wastePlates,
        ]),
      },
      {
        title: 'No-shows by hostel',
        columns: ['Hostel', 'Served', 'No-shows', 'No-show rate'],
        rows: report.byHostel.map((row) => [
          row.hostelName,
          row.served,
          row.noShows,
          percent(row.noShowRatePct),
        ]),
      },
      {
        title: 'Slots',
        columns: ['Meal', 'Slot', 'Served per day', 'Utilization', 'Days over capacity'],
        rows: report.slots.map((slot) => [
          slot.mealType,
          slot.label,
          slot.averageServedPerDay,
          percent(slot.utilizationPct),
          slot.overCapacityDays,
        ]),
      },
      {
        title: 'Cancellation lead time',
        columns: ['Before the slot', 'Cancellations'],
        rows: report.cancellations.buckets.map((row) => [BUCKET_NAMES[row.bucket], row.count]),
      },
      {
        title: 'Leave',
        columns: ['Status', 'Requests starting in range'],
        rows: report.leaves.map((row) => [row.status, row.count]),
      },
      {
        title: 'Complaints',
        note:
          report.complaints.averageResolutionHours === null
            ? undefined
            : `Average resolution: ${report.complaints.averageResolutionHours} hours.`,
        columns: ['Category', 'Complaints'],
        rows: report.complaints.byCategory.map((row) => [row.category, row.count]),
      },
    ],
  };
}
