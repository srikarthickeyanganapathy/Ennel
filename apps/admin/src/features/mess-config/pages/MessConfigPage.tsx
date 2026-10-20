import { useQuery } from '@tanstack/react-query';
import { QueryBoundary } from '@/shared/components/QueryStates';
import { PageHeader } from '@/shared/layout/PageHeader';
import { listMeals } from '../api/mess-config-api';
import { MealWindowCard } from '../components/MealWindowCard';
import { ThresholdsCard } from '../components/ThresholdsCard';

/** Admin §D: meals, serving windows, slots, capacities and availability thresholds. */
export function MessConfigPage() {
  const meals = useQuery({ queryKey: ['mess-config', 'meals'], queryFn: listMeals });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Mess configuration"
        breadcrumbs={[{ label: 'Mess configuration' }]}
        description="Every change is recorded in the audit log."
      />
      <QueryBoundary
        isLoading={meals.isLoading}
        error={meals.error}
        onRetry={() => void meals.refetch()}
      >
        {(meals.data ?? []).map((meal) => (
          <MealWindowCard key={meal.id} meal={meal} />
        ))}
      </QueryBoundary>
      <ThresholdsCard />
    </div>
  );
}
