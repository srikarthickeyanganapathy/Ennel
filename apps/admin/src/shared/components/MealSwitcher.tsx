import { type MealType } from '@ennel/shared';
import { cn } from '@/shared/lib/utils';

interface MealSwitcherProps {
  meals: { mealType: MealType; mealName: string }[];
  selected: MealType | null;
  onChange: (meal: MealType) => void;
}

/** The Figma "Meal switcher": one meal at a time, as a segmented control. */
export function MealSwitcher({ meals, selected, onChange }: MealSwitcherProps) {
  if (meals.length === 0) return null;
  return (
    <div role="radiogroup" aria-label="Meal" className="flex rounded-md bg-neutral-surface p-1">
      {meals.map((meal) => {
        const isSelected = meal.mealType === selected;
        return (
          <button
            key={meal.mealType}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(meal.mealType)}
            className={cn(
              'min-h-9 flex-1 rounded-sm px-4 text-sm transition-colors sm:flex-none',
              isSelected
                ? 'bg-background font-semibold text-primary shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                : 'font-medium text-muted-foreground hover:text-foreground',
            )}
          >
            {meal.mealName}
          </button>
        );
      })}
    </div>
  );
}
