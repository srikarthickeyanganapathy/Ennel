import { type PendingWork } from '@ennel/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth, usePermissions } from '@/features/auth/auth-context';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { QueryBoundary } from '@/shared/components/QueryStates';
import { Button } from '@/shared/components/ui/button';
import { Card, CardHeader } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/form-controls';
import { PageHeader } from '@/shared/layout/PageHeader';
import { formatBusinessDate, formatDateTime } from '@/shared/lib/format';
import { getDashboard } from '../api/dashboard-api';
import { MealSummaryCard } from '../components/MealSummaryCard';
import { TrendCharts } from '../components/TrendCharts';

/** Admin §C: today (or a chosen date) at a glance; refreshes every minute. */
export function DashboardPage() {
  const { me } = useAuth();
  const can = usePermissions();
  const canSee = can('dashboard:read') || can('dashboard:read-today');
  const [date, setDate] = useState<string | undefined>(undefined);
  const dashboard = useQuery({
    queryKey: ['dashboard', date],
    queryFn: () => getDashboard(date),
    enabled: canSee,
    refetchInterval: 60_000,
  });
  const data = dashboard.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={
          data
            ? `${formatBusinessDate(data.date)}${data.date === data.today ? ' (today)' : ''} · updated ${formatDateTime(data.generatedAt)}`
            : `Signed in as ${me?.fullName ?? ''}`
        }
        actions={
          data?.canChooseDate ? (
            <Input
              type="date"
              aria-label="Dashboard date"
              className="w-40"
              value={date ?? data.date}
              onChange={(event) => setDate(event.target.value || undefined)}
            />
          ) : null
        }
      />
      {canSee ? (
        <QueryBoundary
          isLoading={dashboard.isLoading}
          error={dashboard.error}
          onRetry={() => void dashboard.refetch()}
        >
          {data ? (
            <>
              <div className="grid gap-4 lg:grid-cols-3">
                {data.meals.map((meal) => (
                  <MealSummaryCard key={meal.mealType} meal={meal} />
                ))}
              </div>
              <PendingWorkCards pending={data.pending} />
              <TrendCharts trend={data.trend} />
            </>
          ) : null}
        </QueryBoundary>
      ) : null}
      <QuickActions />
    </div>
  );
}

const PENDING: { key: keyof PendingWork; label: string }[] = [
  { key: 'leaveApprovals', label: 'Leave approvals' },
  { key: 'openComplaints', label: 'Open complaints' },
  { key: 'noShowAppeals', label: 'No-show appeals' },
  { key: 'attendanceIssues', label: 'Attendance issues' },
];

/** Pending-work counts; their pages arrive with the leave, complaint and no-show phases. */
function PendingWorkCards({ pending }: { pending: PendingWork }) {
  return (
    <Card>
      <CardHeader title="Pending work" />
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PENDING.map(({ key, label }) => (
          <div key={key} className="rounded-md bg-muted p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className={`text-2xl font-semibold ${pending[key] > 0 ? 'text-warning' : ''}`}>
              {pending[key]}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function QuickActions() {
  return (
    <Card>
      <CardHeader title="Quick actions" />
      <div className="flex flex-wrap gap-2">
        <PermissionGate permissions={['bookings:read']}>
          <Button variant="outline" asChild>
            <Link to="/bookings">Bookings</Link>
          </Button>
        </PermissionGate>
        <PermissionGate permissions={['menus:publish']}>
          <Button variant="outline" asChild>
            <Link to="/menus">Publish menu</Link>
          </Button>
        </PermissionGate>
        <PermissionGate permissions={['roster:import']}>
          <Button variant="outline" asChild>
            <Link to="/students/import">Import roster</Link>
          </Button>
        </PermissionGate>
        <PermissionGate permissions={['mess-config:read']}>
          <Button variant="outline" asChild>
            <Link to="/mess-config">Slots and capacities</Link>
          </Button>
        </PermissionGate>
      </div>
    </Card>
  );
}
