import { type DashboardMeal } from '@ennel/shared';
import { TriangleAlert } from 'lucide-react';
import { Card } from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/utils';

type Slot = DashboardMeal['slots'][number];

const STATUS_TEXT: Record<Slot['status'], string> = {
  AVAILABLE: 'Available',
  FILLING_FAST: 'Filling fast',
  FULL: 'Full',
  OVER_CAPACITY: 'Over capacity',
};
const isAtLimit = (slot: Slot) => slot.status === 'FULL' || slot.status === 'OVER_CAPACITY';
/** "11:00 AM - 11:30 AM" → "11:00 AM": the chart labels a slot by its start. */
const startOf = (label: string) => label.split(' - ')[0] ?? label;

/**
 * Figma "slot occupancy": booked against capacity per slot. Columns on wider screens, bars in a
 * list on phones (the mobile frame). Served-per-slot is not in the API yet, so only booked shows.
 */
export function SlotOccupancy({ meal }: { meal: DashboardMeal }) {
  const capacities = meal.slots.map((slot) => slot.officialCapacity);
  const scale = Math.max(1, ...capacities, ...meal.slots.map((slot) => slot.bookedCount));
  const sameCapacity = capacities.every((capacity) => capacity === capacities[0]);
  return (
    <Card className="flex flex-col gap-4 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold sm:text-lg">
            <span className="md:hidden">Slots</span>
            <span className="hidden md:inline">{meal.mealName} slot occupancy</span>
          </h2>
          <p className="hidden text-[13px] text-muted-foreground md:block">
            Booked vs capacity per slot
            {sameCapacity && capacities[0] !== undefined ? ` · capacity ${capacities[0]} each` : ''}
          </p>
        </div>
        <ul className="hidden items-center gap-4 text-xs text-muted-foreground md:flex">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-[3px] bg-primary" /> Booked
          </li>
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-3 rounded-[3px] border-[1.5px] border-dashed border-muted-foreground"
            />{' '}
            Capacity
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-[3px] bg-danger" /> Full
          </li>
        </ul>
      </div>
      {meal.slots.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active slots for this meal.</p>
      ) : (
        <>
          <Columns slots={meal.slots} scale={scale} />
          <BarList slots={meal.slots} />
        </>
      )}
    </Card>
  );
}

function Columns({ slots, scale }: { slots: Slot[]; scale: number }) {
  return (
    <div className="hidden md:block">
      <div className="flex gap-4 pb-1 pl-10 pr-2">
        {slots.map((slot) => (
          <span
            key={slot.slotId}
            className="flex-1 text-center text-xs font-semibold text-foreground"
          >
            {slot.bookedCount}/{slot.officialCapacity}
          </span>
        ))}
      </div>
      <div className="relative h-48">
        {/* Gridlines at 0, half and the top of the scale, as in the design's plot. */}
        {[1, 0.5, 0].map((fraction) => (
          <div
            key={fraction}
            aria-hidden
            className="absolute inset-x-0 flex items-center gap-2"
            style={{ bottom: `${fraction * 100}%`, transform: 'translateY(50%)' }}
          >
            <span className="w-8 text-right text-[11px] text-muted-foreground">
              {Math.round(scale * fraction)}
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
        ))}
        <div
          className="absolute inset-0 flex items-end gap-4 pl-10 pr-2"
          role="list"
          aria-label="Slot occupancy"
        >
          {slots.map((slot) => (
            <div
              key={slot.slotId}
              role="listitem"
              aria-label={`${slot.label}: ${slot.bookedCount} of ${slot.officialCapacity} booked, ${STATUS_TEXT[slot.status]}`}
              className="flex h-full flex-1 justify-center"
            >
              <div className="relative h-full w-full max-w-12">
                <div
                  className="absolute inset-x-0 bottom-0 rounded-t-[4px] border border-dashed border-muted-foreground/45"
                  style={{ height: `${(slot.officialCapacity / scale) * 100}%` }}
                />
                <div
                  className={cn(
                    'absolute inset-x-0 bottom-0 rounded-t-[4px]',
                    isAtLimit(slot) ? 'bg-danger' : 'bg-primary',
                  )}
                  style={{ height: `${Math.min(100, (slot.bookedCount / scale) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-4 pl-10 pr-2 pt-2">
        {slots.map((slot) => (
          <div key={slot.slotId} className="flex flex-1 flex-col items-center text-center">
            <span className="text-xs font-medium text-muted-foreground">{startOf(slot.label)}</span>
            {isAtLimit(slot) ? (
              <span className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-danger">
                <TriangleAlert aria-hidden className="size-3" />
                {STATUS_TEXT[slot.status]}
              </span>
            ) : slot.status === 'FILLING_FAST' ? (
              <span className="mt-0.5 text-[11px] font-semibold text-warning">Filling fast</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function BarList({ slots }: { slots: Slot[] }) {
  return (
    <ul className="flex flex-col gap-3 md:hidden">
      {slots.map((slot) => {
        const atLimit = isAtLimit(slot);
        return (
          <li key={slot.slotId}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold">{startOf(slot.label)}</span>
              <span
                className={cn('text-[13px]', atLimit ? 'text-danger' : 'text-muted-foreground')}
              >
                {slot.bookedCount}/{slot.officialCapacity} · {STATUS_TEXT[slot.status]}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={`${slot.label} occupancy`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, slot.occupancyPct)}
              className="h-1.5 overflow-hidden rounded-full bg-neutral-surface"
            >
              <div
                className={cn('h-full rounded-full', atLimit ? 'bg-danger' : 'bg-primary')}
                style={{ width: `${Math.min(100, slot.occupancyPct)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
