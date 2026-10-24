import { type DashboardMeal } from '@ennel/shared';
import { StatusBadge, type StatusTone } from '@/shared/components/StatusBadge';
import { Card, CardHeader } from '@/shared/components/ui/card';

const SLOT_STATUS: Record<
  DashboardMeal['slots'][number]['status'],
  { label: string; tone: StatusTone }
> = {
  AVAILABLE: { label: 'Available', tone: 'success' },
  FILLING_FAST: { label: 'Filling fast', tone: 'warning' },
  FULL: { label: 'Full', tone: 'danger' },
  OVER_CAPACITY: { label: 'Over capacity', tone: 'danger' },
};

/** Admin §C meal summary: plates, Veg/Non-Veg split and per-slot occupancy. */
export function MealSummaryCard({ meal }: { meal: DashboardMeal }) {
  return (
    <Card>
      <CardHeader
        title={meal.mealName}
        description={meal.closureTitle ? `Mess closed: ${meal.closureTitle}` : undefined}
        actions={
          meal.overCapacitySlotCount > 0 ? (
            <StatusBadge label={`${meal.overCapacitySlotCount} over capacity`} tone="danger" />
          ) : null
        }
      />
      <dl className="grid grid-cols-3 gap-2 text-center">
        <Figure label="Booked" value={meal.booked} />
        <Figure label="Expected" value={meal.expected} />
        <Figure label="Attended" value={meal.attended} />
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        Expected = booked × {meal.showUpRatePct}% show-up rate.
        {meal.isExpectedLowConfidence
          ? ' Low confidence: less than 7 days of attendance history.'
          : ''}
      </p>
      <p className="mt-3 text-sm">
        Veg <strong>{meal.veg}</strong> · Non-Veg <strong>{meal.nonVeg}</strong>
      </p>
      <ul className="mt-3 space-y-2" aria-label={`${meal.mealName} slots`}>
        {meal.slots.map((slot) => (
          <li key={slot.slotId}>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span>{slot.label}</span>
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  {slot.bookedCount} / {slot.officialCapacity}
                </span>
                {slot.isRecommended ? <StatusBadge label="Recommended" tone="info" /> : null}
                <StatusBadge {...SLOT_STATUS[slot.status]} />
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div
                className={
                  slot.occupancyPct >= 100
                    ? 'h-2 bg-danger'
                    : slot.occupancyPct >= 80
                      ? 'h-2 bg-warning'
                      : 'h-2 bg-primary'
                }
                style={{ width: `${slot.occupancyPct}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted p-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold">{value}</dd>
    </div>
  );
}
