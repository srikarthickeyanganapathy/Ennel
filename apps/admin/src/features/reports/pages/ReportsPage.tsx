import {
  type AdminReport,
  MEAL_TYPE_ORDER,
  type MealType,
  REPORT_DIRECT_EXPORT_MAX_DAYS,
  type ReportFormat,
  type ReportGrouping,
} from '@ennel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/shared/api-client/api-error';
import { ChoiceChip } from '@/shared/components/ChoiceChip';
import { DatePickerButton } from '@/shared/components/DatePickerButton';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { QueryBoundary } from '@/shared/components/QueryStates';
import { Button } from '@/shared/components/ui/button';
import { Select } from '@/shared/components/ui/form-controls';
import { PageHeader } from '@/shared/layout/PageHeader';
import { addDays, formatBusinessDate, todayBusinessDate } from '@/shared/lib/format';
import { downloadReport, getReport, requestReportExport } from '../api/reports-api';
import { ReportExportsCard } from '../components/ReportExportsCard';
import {
  CancellationsSection,
  ComplaintsSection,
  CrowdingSection,
  HostelsSection,
  Kpi,
  LeavesSection,
  MealTable,
  SlotsSection,
  TrendSection,
} from '../components/ReportSections';

const MEAL_NAMES: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
};
const GROUPINGS: { value: ReportGrouping; label: string }[] = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
];
const DEFAULT_RANGE_DAYS = 30;

function daysBetween(from: string, to: string): number {
  return (
    Math.round(
      (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) /
        86_400_000,
    ) + 1
  );
}

/** Figma "Admin — Reports" (Admin §O). Definitions are in ADR-0029. */
export function ReportsPage() {
  const queryClient = useQueryClient();
  const today = todayBusinessDate();
  const [from, setFrom] = useState(() => addDays(today, -(DEFAULT_RANGE_DAYS - 1)));
  const [to, setTo] = useState(today);
  const [mealType, setMealType] = useState<MealType | null>(null);
  const [hostelId, setHostelId] = useState('');
  const [groupBy, setGroupBy] = useState<ReportGrouping>('day');
  const query = {
    from,
    to,
    groupBy,
    mealType: mealType ?? undefined,
    hostelId: hostelId || undefined,
  };
  const report = useQuery({ queryKey: ['report', query], queryFn: () => getReport(query) });
  const isLong = daysBetween(from, to) > REPORT_DIRECT_EXPORT_MAX_DAYS;
  const download = useMutation({
    mutationFn: async (format: ReportFormat) => {
      if (!isLong) return downloadReport(query, format);
      await requestReportExport(query, format);
      toast.success('This is a long range, so it is being built in the background.');
      await queryClient.invalidateQueries({ queryKey: ['report-exports'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div>
      <PageHeader
        title="Reports"
        breadcrumbs={[{ label: 'Reports' }]}
        description="Attendance and meal reports"
        actions={
          <>
            <DatePickerButton
              value={from}
              text={`From ${formatBusinessDate(from, 'd MMM yyyy')}`}
              label="From"
              onChange={(date) => date && date <= to && setFrom(date)}
            />
            <DatePickerButton
              value={to}
              text={`To ${formatBusinessDate(to, 'd MMM yyyy')}`}
              label="To"
              onChange={(date) => date && date >= from && date <= today && setTo(date)}
            />
          </>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Meal" className="flex flex-wrap gap-2">
          <ChoiceChip
            label="Overall"
            isSelected={mealType === null}
            onClick={() => setMealType(null)}
          />
          {MEAL_TYPE_ORDER.map((meal) => (
            <ChoiceChip
              key={meal}
              label={MEAL_NAMES[meal]}
              isSelected={mealType === meal}
              onClick={() => setMealType(meal)}
            />
          ))}
        </div>
        <Select
          variant="chip"
          isActive={Boolean(hostelId)}
          aria-label="Hostel"
          value={hostelId}
          onChange={(event) => setHostelId(event.target.value)}
        >
          <option value="">All hostels</option>
          {(report.data?.hostels ?? []).map((hostel) => (
            <option key={hostel.id} value={hostel.id}>
              {hostel.name}
            </option>
          ))}
        </Select>
        <PermissionGate permissions={['reports:export']}>
          <div className="ml-auto flex flex-wrap gap-2">
            {(['csv', 'pdf'] as const).map((format) => (
              <Button
                key={format}
                variant="ghost"
                className="h-12 font-semibold text-primary"
                disabled={download.isPending}
                onClick={() => download.mutate(format)}
              >
                Export {format.toUpperCase()}
              </Button>
            ))}
            <Button
              variant="outline"
              className="h-12 border-[1.5px] border-primary font-semibold text-primary"
              disabled={download.isPending}
              onClick={() => download.mutate('xlsx')}
            >
              Export Excel
            </Button>
          </div>
        </PermissionGate>
      </div>
      <QueryBoundary
        isLoading={report.isLoading}
        error={report.error}
        onRetry={() => void report.refetch()}
      >
        {report.data ? (
          <ReportBody
            report={report.data}
            mealType={mealType}
            groupBy={groupBy}
            onGroupBy={setGroupBy}
          />
        ) : null}
      </QueryBoundary>
    </div>
  );
}

function ReportBody({
  report,
  mealType,
  groupBy,
  onGroupBy,
}: {
  report: AdminReport;
  mealType: MealType | null;
  groupBy: ReportGrouping;
  onGroupBy: (grouping: ReportGrouping) => void;
}) {
  const { kpis } = report;
  const cancelledPct = kpis.total === 0 ? 0 : Math.round((kpis.cancelled / kpis.total) * 100);
  const rate = kpis.noShowRatePct === null ? 'No finished meals' : `${kpis.noShowRatePct}%`;
  const wasteChange = kpis.wastePlates - kpis.previousWastePlates;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Meals served"
          value={kpis.served.toLocaleString('en-IN')}
          note={`of ${kpis.total.toLocaleString('en-IN')} booked`}
        />
        <Kpi
          label="Cancelled"
          value={kpis.cancelled.toLocaleString('en-IN')}
          note={`${cancelledPct}% of bookings`}
        />
        <Kpi
          label="No-shows"
          value={kpis.noShows.toLocaleString('en-IN')}
          note={
            kpis.previousNoShowRatePct === null
              ? rate
              : `${rate} · was ${kpis.previousNoShowRatePct}% the period before`
          }
        />
        <Kpi
          label="Waste estimate"
          value={`${kpis.wastePlates.toLocaleString('en-IN')} plates`}
          note={
            wasteChange === 0
              ? 'Same as the period before'
              : `${Math.abs(wasteChange).toLocaleString('en-IN')} ${wasteChange > 0 ? 'more' : 'fewer'} than the period before`
          }
        />
      </div>
      <MealTable report={report} />
      <div role="radiogroup" aria-label="Group by" className="flex flex-wrap gap-2">
        {GROUPINGS.map((grouping) => (
          <ChoiceChip
            key={grouping.value}
            label={grouping.label}
            isSelected={groupBy === grouping.value}
            onClick={() => onGroupBy(grouping.value)}
          />
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-2">
        <TrendSection report={report} />
        <CrowdingSection report={report} mealType={mealType} />
        <ComplaintsSection report={report} />
        <CancellationsSection report={report} />
        <HostelsSection report={report} />
        <SlotsSection report={report} />
        <LeavesSection report={report} />
        <ReportExportsCard />
      </div>
    </div>
  );
}
