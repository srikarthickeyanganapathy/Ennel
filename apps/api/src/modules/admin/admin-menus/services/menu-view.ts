import { type AdminMenu, type BusinessDate, type MealType } from '@ennel/shared';
import { hashMenuContent } from '../domain/menu-rules';
import { type StoredMenu } from '../repositories/admin-menus.repository';

export function toAdminMenu(menu: StoredMenu): AdminMenu {
  const isPublished = menu.status === 'PUBLISHED';
  return {
    id: menu.id,
    mealDate: menu.mealDate,
    mealType: menu.mealType,
    status: menu.status,
    // Draft edits on a published menu stay invisible to students until republished (Admin §E).
    hasUnpublishedChanges: isPublished ? hashMenuContent(menu) !== menu.contentHash : true,
    isSpecial: menu.isSpecial,
    specialTitle: menu.specialTitle,
    items: menu.items,
    publishedItems: menu.publishedItems,
    publishedAt: menu.publishedAt?.toISOString() ?? null,
    version: menu.version,
  };
}

export function emptyMenu(mealDate: BusinessDate, mealType: MealType): AdminMenu {
  return {
    id: null,
    mealDate,
    mealType,
    status: 'NONE',
    hasUnpublishedChanges: false,
    isSpecial: false,
    specialTitle: null,
    items: [],
    publishedItems: null,
    publishedAt: null,
    version: null,
  };
}
