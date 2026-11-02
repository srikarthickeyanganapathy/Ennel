import { type MealType, type NoShowAtRisk } from '@ennel/shared';
import { Card } from '@/shared/components/ui/card';

const MEAL_NAMES: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
};

/**
 * Figma "At risk" card (BR-NS-4). Students are already told once at the warning level (BR-NS-9),
 * and no rule covers staff sending more, so the design's "Send reminder" button is not shown.
 */
export function AtRiskCard({ atRisk }: { atRisk: NoShowAtRisk }) {
  const { warningThreshold: warnAt, disableThreshold: disableAt, items, total } = atRisk;
  const range = warnAt < disableAt - 1 ? `${warnAt}–${disableAt - 1}` : `${warnAt}`;
  return (
    <Card className="flex flex-col gap-2">
      <h2 className="text-base font-semibold">At risk · {range} No-shows</h2>
      <p className="text-xs text-muted-foreground">
        Students are told when they reach {warnAt}. Default Booking turns off at {disableAt}.
      </p>
      {items.length === 0 ? (
        <p className="py-2 text-[13px] text-muted-foreground">No students are at risk right now.</p>
      ) : (
        <ul>
          {items.map(({ student, mealType, count }) => (
            <li
              key={`${student.id}-${mealType}`}
              className="flex items-center justify-between gap-2 py-1.5"
            >
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[13px] font-semibold">{student.fullName}</span>
                <span className="block text-xs text-muted-foreground">{MEAL_NAMES[mealType]}</span>
              </span>
              <span className="text-[13px] font-semibold text-warning">
                {count}/{disableAt}
              </span>
            </li>
          ))}
        </ul>
      )}
      {total > items.length ? (
        <p className="text-xs text-muted-foreground">
          Showing the {items.length} closest of {total}.
        </p>
      ) : null}
    </Card>
  );
}
