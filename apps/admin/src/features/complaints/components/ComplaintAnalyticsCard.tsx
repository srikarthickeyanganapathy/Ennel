import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { QueryBoundary } from '@/shared/components/QueryStates';
import { Card, CardHeader } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/form-controls';
import { addDays, todayBusinessDate } from '@/shared/lib/format';
import { getComplaintAnalytics } from '../api/complaints-api';
import { CATEGORY_NAMES, MEAL_NAMES, STATUS } from './complaint-labels';

/** Admin §L "category/meal quality analytics", with resolution time (Admin §O). */
export function ComplaintAnalyticsCard() {
  const today = todayBusinessDate();
  const [range, setRange] = useState({ from: addDays(today, -29), to: today });
  const analytics = useQuery({
    queryKey: ['admin-complaints', 'analytics', range],
    queryFn: () => getComplaintAnalytics(range.from, range.to),
    enabled: range.from <= range.to,
  });
  const data = analytics.data;
  return (
    <Card>
      <CardHeader
        title="Quality overview"
        description="Complaints and feedback received in the chosen dates."
        actions={
          <>
            <Input
              aria-label="Analytics from"
              type="date"
              className="w-40"
              value={range.from}
              onChange={(event) => setRange((r) => ({ ...r, from: event.target.value }))}
            />
            <Input
              aria-label="Analytics to"
              type="date"
              className="w-40"
              value={range.to}
              onChange={(event) => setRange((r) => ({ ...r, to: event.target.value }))}
            />
          </>
        }
      />
      <QueryBoundary
        isLoading={analytics.isLoading}
        error={analytics.error}
        onRetry={() => void analytics.refetch()}
      >
        {data ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Received" value={String(data.total)} />
            <Stat
              label="Average time to close"
              value={
                data.averageResolutionHours === null
                  ? 'None closed yet'
                  : `${data.averageResolutionHours} hours`
              }
            />
            <Breakdown
              title="By category"
              rows={data.byCategory.map((row) => [CATEGORY_NAMES[row.category], row.count])}
            />
            <Breakdown
              title="By meal"
              rows={data.byMeal.map((row) => [
                row.mealType ? MEAL_NAMES[row.mealType] : 'Not about a meal',
                row.count,
              ])}
            />
            <Breakdown
              title="By status"
              rows={data.byStatus.map((row) => [STATUS[row.status].label, row.count])}
            />
          </div>
        ) : null}
      </QueryBoundary>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing yet</p>
      ) : (
        <ul className="space-y-0.5 text-sm">
          {rows.map(([label, count]) => (
            <li key={label} className="flex justify-between gap-4">
              <span>{label}</span>
              <span className="font-medium">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
