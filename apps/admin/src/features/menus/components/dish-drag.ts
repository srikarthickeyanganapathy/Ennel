import { menuItemInputSchema, type MenuItemInput } from '@ennel/shared';

const DISH_TYPE = 'application/x-ennel-dish';

export function writeDraggedDish(transfer: DataTransfer, dish: MenuItemInput): void {
  transfer.setData(DISH_TYPE, JSON.stringify(dish));
  transfer.effectAllowed = 'copy';
}

/** Anything can be dropped on a page, so only a valid dish from the library is accepted. */
export function readDraggedDish(transfer: DataTransfer): MenuItemInput | null {
  const raw = transfer.getData(DISH_TYPE);
  if (!raw) return null;
  try {
    const dish = menuItemInputSchema.safeParse(JSON.parse(raw));
    return dish.success ? dish.data : null;
  } catch {
    return null;
  }
}
