import {
  type AdminMenu,
  adminMenuSchema,
  type MealType,
  type MenuWeek,
  menuWeekSchema,
  type PublishMenuResponse,
  publishMenuResponseSchema,
  type SaveMenuRequest,
} from '@ennel/shared';
import { z } from 'zod';
import { apiRequest } from '@/shared/api-client/api-client';

export const getMenuWeek = (from: string): Promise<MenuWeek> =>
  apiRequest('/menus', { query: { from, days: 7 }, schema: menuWeekSchema });

export const saveMenu = (
  date: string,
  mealType: MealType,
  body: SaveMenuRequest,
): Promise<AdminMenu> =>
  apiRequest(`/menus/${date}/${mealType}`, { method: 'PUT', body, schema: adminMenuSchema });

export const publishMenu = (id: string, version: number): Promise<PublishMenuResponse> =>
  apiRequest(`/menus/${id}/publish`, {
    method: 'POST',
    body: { version },
    schema: publishMenuResponseSchema,
  });

export const copyMenuWeek = (
  fromWeekStart: string,
  toWeekStart: string,
  overwrite: boolean,
): Promise<{ copied: number }> =>
  apiRequest('/menus/copy-week', {
    method: 'POST',
    body: { fromWeekStart, toWeekStart, overwrite },
    schema: z.object({ copied: z.number() }),
  });
