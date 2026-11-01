import { type MealType } from '@ennel/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { usePermissions } from '@/features/auth/auth-context';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { QueryBoundary } from '@/shared/components/QueryStates';
import { Button } from '@/shared/components/ui/button';
import { Card, CardHeader } from '@/shared/components/ui/card';
import { getDashboard } from '../api/dashboard-api';
import { AnnouncementsTodayCard } from '../components/AnnouncementsTodayCard';
import { DashboardHeader } from '../components/DashboardHeader';
import { MealCountCard } from '../components/MealCountCard';
import { MealKpis } from '../components/MealKpis';
import { NeedsActionCard } from '../components/NeedsActionCard';
import { SlotOccupancy } from '../components/SlotOccupancy';
import { TrendCard } from '../components/TrendCard';

/**
 * Admin §C live dashboard, built from the Figma "Admin — Live dashboard" desktop and mobile
 * frames. Refreshes every minute. On phones the order follows the mobile frame; from `xl` up the
 * cards are placed on the desktop grid.
 */
export function DashboardPage() {
  const can = usePermissions();
  const canSee = can('dashboard:read') || can('dashboard:read-today');
  const [date, setDate] = useState<string | undefined>(undefined);
  const [chosenMeal, setChosenMeal] = useState<MealType | null>(null);
  const dashboard = useQuery({
    queryKey: ['dashboard', date],
    queryFn: () => getDashboard(date),
    enabled: canSee,
    refetchInterval: 60_000,
  });
  const data = dashboard.data;
  const meals = data?.meals ?? [];
  const meal = meals.find((item) => item.mealType === chosenMeal) ?? meals[0] ?? null;

  return (
    <div className="space-y-6">
      <DashboardHeader
        date={data?.date ?? null}
        today={data?.today ?? null}
        generatedAt={data?.generatedAt ?? null}
        canChooseDate={data?.canChooseDate ?? false}
        onDateChange={setDate}
        meals={meals}
        selectedMeal={meal?.mealType ?? null}
        onMealChange={setChosenMeal}
      />
      {canSee ? (
        <QueryBoundary
          isLoading={dashboard.isLoading}
          error={dashboard.error}
          onRetry={() => void dashboard.refetch()}
        >
          {data && meal ? (
            <div className="grid gap-4 sm:gap-6 xl:grid-cols-3">
              <div className="order-2 xl:col-span-3 xl:row-start-1">
                <MealKpis meal={meal} />
              </div>
              <div className="order-3 xl:col-span-2 xl:row-span-2 xl:row-start-2 xl:self-start">
                <SlotOccupancy meal={meal} />
              </div>
              <div className="order-1 xl:col-start-3 xl:row-start-2">
                <MealCountCard meal={meal} date={data.date} />
              </div>
              <div className="order-4 xl:col-start-3 xl:row-start-3">
                <NeedsActionCard pending={data.pending} />
              </div>
              <div className="order-5 xl:col-span-2 xl:row-start-4">
                <TrendCard trend={data.trend} />
              </div>
              <div className="order-6 xl:col-start-3 xl:row-start-4">
                <AnnouncementsTodayCard date={data.date} />
              </div>
            </div>
          ) : null}
        </QueryBoundary>
      ) : null}
      <QuickActions />
    </div>
  );
}

/** Admin §C quick actions: publish menu, send announcement, open the attendance counter. */
function QuickActions() {
  return (
    <Card>
      <CardHeader title="Quick actions" />
      <div className="flex flex-wrap gap-2">
        <PermissionGate permissions={['menus:publish']}>
          <Button variant="outline" asChild>
            <Link to="/menus">Publish menu</Link>
          </Button>
        </PermissionGate>
        <PermissionGate permissions={['announcements:manage']}>
          <Button variant="outline" asChild>
            <Link to="/announcements">Send announcement</Link>
          </Button>
        </PermissionGate>
        <PermissionGate permissions={['attendance:read']}>
          <Button variant="outline" asChild>
            <Link to="/attendance">Open attendance counter</Link>
          </Button>
        </PermissionGate>
        <PermissionGate permissions={['bookings:read']}>
          <Button variant="outline" asChild>
            <Link to="/bookings">Bookings</Link>
          </Button>
        </PermissionGate>
      </div>
    </Card>
  );
}
