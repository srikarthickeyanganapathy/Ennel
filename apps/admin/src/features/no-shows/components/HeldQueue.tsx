import { type MealType } from '@ennel/shared';
import { useQuery } from '@tanstack/react-query';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { Button } from '@/shared/components/ui/button';
import { Card, CardHeader } from '@/shared/components/ui/card';
import { formatBusinessDate } from '@/shared/lib/format';
import { listNoShows } from '../api/no-shows-api';
import { type NoShowAction } from './NoShowActionDialog';

const MEAL_NAMES: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
};

/** BR-NS-7: No-shows recorded while outage mode was on. */
export function HeldQueue({ onAction }: { onAction: (action: NoShowAction) => void }) {
  const held = useQuery({
    queryKey: ['admin-no-shows', 'held'],
    queryFn: () => listNoShows({ status: 'HELD_FOR_REVIEW', page: 1, pageSize: 50 }),
  });
  const items = held.data?.items ?? [];
  if (!held.data || items.length === 0) return null;
  return (
    <Card>
      <CardHeader
        title={`Held during an outage (${held.data.heldForReview})`}
        description="These do not count until you confirm them."
      />
      <ul className="divide-y divide-border">
        {items.map((event) => (
          <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="text-sm">
              <strong>{event.student.fullName}</strong>{' '}
              <span className="text-muted-foreground">{event.student.referenceNumber}</span>
              <span className="block">
                {MEAL_NAMES[event.mealType]}, {formatBusinessDate(event.date, 'EEE d MMM')}
              </span>
            </span>
            <PermissionGate permissions={['no-shows:review-appeal']}>
              <span className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAction({ kind: 'confirm', event })}
                >
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAction({ kind: 'dismiss', event })}
                >
                  Dismiss
                </Button>
              </span>
            </PermissionGate>
          </li>
        ))}
      </ul>
    </Card>
  );
}
