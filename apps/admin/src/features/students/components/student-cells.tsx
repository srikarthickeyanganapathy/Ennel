import { type AdminStudentListItem, MEAL_TYPE_ORDER, type MealType } from '@ennel/shared';
import { cn } from '@/shared/lib/utils';

export const MEAL_NAMES: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
};
const DEFAULT_WORDS = { ON: 'on', OFF: 'off', AUTO_OFF: 'off after No-shows' } as const;

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

/** Figma "Default (B L D)": a filled dot per meal that books; red ring when No-shows turned it off. */
export function MealDots({ defaults }: { defaults: AdminStudentListItem['mealDefaults'] }) {
  if (!defaults) return <span className="text-muted-foreground">—</span>;
  const label = MEAL_TYPE_ORDER.map(
    (meal) => `${MEAL_NAMES[meal]} ${DEFAULT_WORDS[defaults[meal] ?? 'OFF']}`,
  ).join(', ');
  return (
    <span
      role="img"
      aria-label={`Default Booking: ${label}`}
      title={label}
      className="flex items-center gap-1.5"
    >
      {MEAL_TYPE_ORDER.map((meal) => {
        const state = defaults[meal] ?? 'OFF';
        return (
          <span
            key={meal}
            className={cn(
              'size-2.5 rounded-full border-[1.5px]',
              state === 'ON' && 'border-primary bg-primary',
              state === 'OFF' && 'border-border bg-background',
              state === 'AUTO_OFF' && 'border-danger bg-background',
            )}
          />
        );
      })}
    </span>
  );
}

/**
 * Figma "No-shows (B L D)": counts coloured by the policy thresholds (BR-NS-4/5): warning colour
 * from the warning threshold, red at the disable threshold.
 */
export function NoShowCounts({
  counts,
  warningThreshold,
  disableThreshold,
}: {
  counts: AdminStudentListItem['noShowCounts'];
  warningThreshold: number;
  disableThreshold: number;
}) {
  if (!counts) return <span className="text-muted-foreground">—</span>;
  const label = MEAL_TYPE_ORDER.map((meal) => `${MEAL_NAMES[meal]} ${counts[meal] ?? 0}`).join(
    ', ',
  );
  return (
    <span
      role="img"
      aria-label={`No-shows: ${label}`}
      title={label}
      className="flex gap-2 text-[13px]"
    >
      {MEAL_TYPE_ORDER.map((meal) => {
        const count = counts[meal] ?? 0;
        return (
          <span
            key={meal}
            className={cn(
              count >= disableThreshold
                ? 'font-semibold text-danger'
                : count >= warningThreshold
                  ? 'font-semibold text-warning'
                  : 'text-muted-foreground',
            )}
          >
            {count}
          </span>
        );
      })}
    </span>
  );
}
