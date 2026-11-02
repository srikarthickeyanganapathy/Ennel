import { type MealType } from '@ennel/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { usePermissions } from '@/features/auth/auth-context';
import { MealSwitcher } from '@/shared/components/MealSwitcher';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { QueryBoundary } from '@/shared/components/QueryStates';
import { Button } from '@/shared/components/ui/button';
import { PageHeader } from '@/shared/layout/PageHeader';
import { todayBusinessDate } from '@/shared/lib/format';
import { getPolicy, getSlotAvailability, getThresholds, listMeals } from '../api/mess-config-api';
import { MealWindowCard } from '../components/MealWindowCard';
import { OverCapacityCard, PlainRulesCard, StudentPreviewCard } from '../components/SlotSideCards';
import { SlotsTable } from '../components/SlotsTable';
import { ThresholdsCard } from '../components/ThresholdsCard';

/**
 * Figma "Admin — Slots & capacity" (Admin §D): one meal at a time, with its slots and live
 * occupancy. Timetable presets and per-slot "Filling fast at" and "Recommended" controls have no
 * rule behind them: the thresholds apply to every slot and Recommended is worked out (ADR-0013).
 */
export function MessConfigPage() {
  const can = usePermissions();
  const canReadPolicy = can('policy:read');
  const [picked, setPicked] = useState<MealType | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const meals = useQuery({ queryKey: ['mess-config', 'meals'], queryFn: listMeals });
  const meal = meals.data?.find((item) => item.mealType === picked) ?? meals.data?.[0] ?? null;
  const today = todayBusinessDate();
  const availability = useQuery({
    queryKey: ['mess-config', 'availability', today, meal?.mealType],
    queryFn: () => getSlotAvailability(today, meal?.mealType ?? 'BREAKFAST'),
    enabled: meal !== null,
  });
  const policy = useQuery({ queryKey: ['policy'], queryFn: getPolicy, enabled: canReadPolicy });
  const thresholds = useQuery({ queryKey: ['mess-config', 'thresholds'], queryFn: getThresholds });
  const live = availability.data;

  return (
    <div>
      <PageHeader
        title="Slots & capacity"
        breadcrumbs={[{ label: 'Slots & capacity' }]}
        description="Every change is recorded in the audit log."
        actions={
          <>
            <MealSwitcher
              meals={(meals.data ?? []).map((item) => ({
                mealType: item.mealType,
                mealName: item.displayName,
              }))}
              selected={meal?.mealType ?? null}
              onChange={setPicked}
            />
            {meal && meal.mealType !== 'BREAKFAST' ? (
              <PermissionGate permissions={['mess-config:update']}>
                <Button
                  variant="outline"
                  className="h-11 border-[1.5px] border-primary font-semibold text-primary"
                  onClick={() => setIsAdding(true)}
                >
                  Add slot
                </Button>
              </PermissionGate>
            ) : null}
          </>
        }
      />
      <QueryBoundary
        isLoading={meals.isLoading}
        error={meals.error}
        onRetry={() => void meals.refetch()}
      >
        {meal ? (
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex min-w-0 flex-col gap-4">
              {live?.isClosed ? (
                <p role="status" className="rounded-md bg-warning-surface p-3 text-sm">
                  The mess is closed for this meal today
                  {live.closureTitle ? `: ${live.closureTitle}` : ''}.
                </p>
              ) : null}
              {/* Keyed so unsaved capacities never carry over to another meal's slots. */}
              <SlotsTable
                key={meal.id}
                meal={meal}
                availability={live?.slots ?? []}
                isAdding={isAdding}
                onAddingChange={setIsAdding}
              />
              <MealWindowCard meal={meal} />
            </div>
            <div className="flex min-w-0 flex-col gap-6">
              {policy.data ? <OverCapacityCard policy={policy.data} /> : null}
              {live ? <StudentPreviewCard slots={live.slots} /> : null}
              {thresholds.data ? (
                <PlainRulesCard thresholds={thresholds.data} policy={policy.data ?? null} />
              ) : null}
              <ThresholdsCard />
            </div>
          </div>
        ) : null}
      </QueryBoundary>
    </div>
  );
}
