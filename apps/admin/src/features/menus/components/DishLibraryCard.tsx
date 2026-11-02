import { DietType } from '@ennel/shared';
import { useQuery } from '@tanstack/react-query';
import { GripVertical, Search } from 'lucide-react';
import { useState } from 'react';
import { ChoiceChip } from '@/shared/components/ChoiceChip';
import { QueryBoundary } from '@/shared/components/QueryStates';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/form-controls';
import { getDishes } from '../api/menus-api';
import { writeDraggedDish } from './dish-drag';
import { DietTag } from './DietTag';

const FILTERS = [
  { value: null, label: 'All' },
  { value: DietType.VEG, label: 'Veg' },
  { value: DietType.NON_VEG, label: 'Non-veg' },
] as const;

/**
 * Figma "Dish library" (Admin §E). There is no separate dish catalogue: the library is every dish
 * already used on a menu. Dragging needs a mouse, so each meal's editor stays the keyboard and
 * touch route for adding a dish.
 */
export function DishLibraryCard() {
  const [search, setSearch] = useState('');
  const [diet, setDiet] = useState<DietType | null>(null);
  const dishes = useQuery({ queryKey: ['menu-dishes'], queryFn: getDishes });
  const term = search.trim().toLowerCase();
  const shown = (dishes.data?.items ?? []).filter(
    (dish) => (!diet || dish.dietType === diet) && dish.name.toLowerCase().includes(term),
  );
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">Dish library</h2>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          aria-label="Search dishes"
          placeholder="Search dishes"
          className="h-10 border-transparent bg-surface pl-9 shadow-none"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div role="radiogroup" aria-label="Dish type" className="flex flex-wrap gap-1.5">
        {FILTERS.map((filter) => (
          <ChoiceChip
            key={filter.label}
            label={filter.label}
            isSelected={diet === filter.value}
            onClick={() => setDiet(filter.value)}
          />
        ))}
      </div>
      <QueryBoundary
        isLoading={dishes.isLoading}
        error={dishes.error}
        onRetry={() => void dishes.refetch()}
      >
        {shown.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            {dishes.data?.items.length === 0
              ? 'Dishes appear here once they are on a menu.'
              : 'No dishes match.'}
          </p>
        ) : (
          <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
            {shown.map((dish) => (
              <li
                key={`${dish.name}-${dish.dietType}`}
                draggable
                onDragStart={(event) => writeDraggedDish(event.dataTransfer, dish)}
                className="flex cursor-grab items-center gap-2.5 rounded-sm border border-border px-2.5 py-2 active:cursor-grabbing"
              >
                <GripVertical aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 text-[13px] font-medium break-words">
                  {dish.name}
                </span>
                <DietTag diet={dish.dietType} />
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>
      <p className="text-xs text-muted-foreground">
        Drag a dish onto a meal to add it, or open the meal to type one.
      </p>
    </Card>
  );
}
