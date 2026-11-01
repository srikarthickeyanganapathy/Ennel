import { type ComplaintAnalytics } from '@ennel/shared';
import { Card } from '@/shared/components/ui/card';
import { CATEGORY_NAMES, MEAL_NAMES } from './complaint-labels';

/**
 * The Figma KPI row. The design shows meal ratings, which ENNEL does not collect, so the cards
 * use the complaint analytics for the last 30 days instead (Admin §L, §O).
 */
export function ComplaintKpis({
  open,
  analytics,
}: {
  open: number | null;
  analytics: ComplaintAnalytics | undefined;
}) {
  const topCategory = analytics?.byCategory[0];
  const topMeal = analytics?.byMeal.find((row) => row.mealType !== null);
  const closed = analytics?.byStatus
    .filter((row) => row.status === 'RESOLVED' || row.status === 'REJECTED')
    .reduce((sum, row) => sum + row.count, 0);
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <Kpi
        label="Open complaints"
        value={open === null ? '—' : String(open)}
        note={
          topCategory
            ? `Top: ${CATEGORY_NAMES[topCategory.category]} (${topCategory.count})`
            : 'New and in review'
        }
      />
      <Kpi
        label="Received · 30 days"
        value={analytics ? String(analytics.total) : '—'}
        note={
          topMeal?.mealType
            ? `Most about ${MEAL_NAMES[topMeal.mealType]} (${topMeal.count})`
            : 'Complaints and feedback'
        }
      />
      <Kpi
        label="Closed · 30 days"
        value={closed === undefined ? '—' : String(closed)}
        note="Resolved or rejected"
      />
      <Kpi
        label="Average time to close"
        value={formatHours(analytics?.averageResolutionHours)}
        note="From submission to a reply"
      />
    </div>
  );
}

function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return '—';
  return hours < 1 ? 'Under 1 h' : `${hours} h`;
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold leading-tight">{value}</p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </Card>
  );
}
