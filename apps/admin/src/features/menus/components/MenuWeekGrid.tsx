import { type AdminMenu, MEAL_TYPE_ORDER, type MealType, type MenuItemInput } from '@ennel/shared';
import { useState } from 'react';
import { formatBusinessDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { DietTag } from './DietTag';
import { readDraggedDish } from './dish-drag';

export const MEAL_NAMES: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
};

/** A menu students do not yet see in this form: a new draft, or published with later edits. */
export const hasUnpublishedWork = (menu: AdminMenu): boolean =>
  menu.items.length > 0 &&
  menu.id !== null &&
  (menu.status === 'DRAFT' || menu.hasUnpublishedChanges);

interface MenuWeekGridProps {
  days: string[];
  today: string;
  menus: AdminMenu[];
  canEdit: boolean;
  onOpen: (menu: AdminMenu) => void;
  onDropDish: (menu: AdminMenu, dish: MenuItemInput) => void;
}

/** Figma week grid (Admin §E): each cell opens its editor and accepts a dish from the library. */
export function MenuWeekGrid({
  days,
  today,
  menus,
  canEdit,
  onOpen,
  onDropDish,
}: MenuWeekGridProps) {
  const find = (date: string, mealType: MealType) =>
    menus.find((menu) => menu.mealDate === date && menu.mealType === mealType);
  return (
    <div className="relative overflow-x-auto rounded-lg border border-border bg-background">
      <table className="w-full min-w-[780px] table-fixed">
        <caption className="sr-only">Menus for the week</caption>
        <thead className="bg-neutral-surface">
          <tr>
            <th scope="col" className="w-24 pl-4">
              <span className="sr-only">Meal</span>
            </th>
            {days.map((date) => (
              <th
                key={date}
                scope="col"
                className={cn(
                  'py-3 pl-2.5 text-left text-xs font-semibold whitespace-nowrap',
                  date === today ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {formatBusinessDate(date, 'EEE d')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MEAL_TYPE_ORDER.map((mealType) => (
            <tr key={mealType} className="border-t border-border align-top">
              <th
                scope="row"
                className="sticky left-0 bg-background py-3 pl-4 text-left text-[13px] font-semibold"
              >
                {MEAL_NAMES[mealType]}
              </th>
              {days.map((date) => {
                const menu = find(date, mealType);
                return menu ? (
                  <MenuCell
                    key={date}
                    menu={menu}
                    canEdit={canEdit}
                    onOpen={onOpen}
                    onDropDish={onDropDish}
                  />
                ) : (
                  <td key={date} className="border-l border-border" />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MenuCell({
  menu,
  canEdit,
  onOpen,
  onDropDish,
}: {
  menu: AdminMenu;
  canEdit: boolean;
  onOpen: (menu: AdminMenu) => void;
  onDropDish: (menu: AdminMenu, dish: MenuItemInput) => void;
}) {
  const [isDropTarget, setIsDropTarget] = useState(false);
  const isUnpublished = hasUnpublishedWork(menu);
  return (
    <td
      className={cn(
        'h-px border-l border-border',
        isUnpublished && 'bg-info-surface',
        isDropTarget && 'bg-mint outline-2 -outline-offset-2 outline-primary',
      )}
      onDragOver={(event) => {
        if (!canEdit) return;
        event.preventDefault();
        setIsDropTarget(true);
      }}
      onDragLeave={() => setIsDropTarget(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDropTarget(false);
        const dish = readDraggedDish(event.dataTransfer);
        if (canEdit && dish) onDropDish(menu, dish);
      }}
    >
      <button
        type="button"
        className="flex size-full min-h-24 flex-col gap-1.5 px-2 py-2.5 text-left hover:bg-mint/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        aria-label={`${canEdit ? 'Edit' : 'View'} ${MEAL_NAMES[menu.mealType]} on ${formatBusinessDate(menu.mealDate)}`}
        onClick={() => onOpen(menu)}
      >
        {menu.isSpecial ? (
          <span className="text-[11px] font-semibold text-primary">{menu.specialTitle}</span>
        ) : null}
        {menu.items.map((item) => (
          <span
            key={`${item.name}-${item.dietType}`}
            className="flex w-full flex-col gap-0.5 rounded-sm border border-border bg-background px-2 py-1.5"
          >
            <DietTag diet={item.dietType} />
            <span className="text-xs leading-tight font-medium break-words text-foreground">
              {item.name}
            </span>
          </span>
        ))}
        {menu.items.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            {canEdit ? 'Add dishes' : 'No menu'}
          </span>
        ) : null}
        {isUnpublished ? (
          <span className="text-[11px] font-semibold text-info">
            {menu.status === 'DRAFT' ? 'Draft' : 'Changed'}
          </span>
        ) : null}
      </button>
    </td>
  );
}
