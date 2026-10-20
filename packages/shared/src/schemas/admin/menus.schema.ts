import { z } from 'zod';
import { businessDateSchema, uuidSchema } from '../common.schema.js';
import { dietTypeSchema, mealTypeSchema } from '../meal-config.schema.js';

export const menuItemInputSchema = z.object({
  name: z.string().trim().min(1, 'Enter the dish name').max(80),
  dietType: dietTypeSchema,
});
export type MenuItemInput = z.infer<typeof menuItemInputSchema>;

/** Admin §E. `status` is NONE until saved; PUBLISHED menus can carry unpublished draft edits. */
export const adminMenuSchema = z.object({
  id: uuidSchema.nullable(),
  mealDate: z.string(),
  mealType: mealTypeSchema,
  status: z.enum(['NONE', 'DRAFT', 'PUBLISHED']),
  hasUnpublishedChanges: z.boolean(),
  isSpecial: z.boolean(),
  specialTitle: z.string().nullable(),
  items: z.array(menuItemInputSchema),
  publishedItems: z.array(menuItemInputSchema).nullable(),
  publishedAt: z.iso.datetime().nullable(),
  version: z.number().int().nullable(),
});
export type AdminMenu = z.infer<typeof adminMenuSchema>;

export const menuWeekQuerySchema = z.object({
  from: businessDateSchema,
  days: z.coerce.number().int().min(1).max(14).default(7),
});
export type MenuWeekQuery = z.input<typeof menuWeekQuerySchema>;

export const menuWeekSchema = z.object({
  from: z.string(),
  days: z.number().int(),
  menus: z.array(adminMenuSchema),
});
export type MenuWeek = z.infer<typeof menuWeekSchema>;

export const saveMenuRequestSchema = z
  .object({
    items: z.array(menuItemInputSchema).max(40),
    isSpecial: z.boolean().default(false),
    specialTitle: z.string().trim().max(80).nullable().optional(),
    /** Omit for a new menu; required to edit an existing one (version check). */
    version: z.number().int().min(1).optional(),
  })
  .refine((value) => !value.isSpecial || Boolean(value.specialTitle), {
    message: 'Give the special meal a title',
    path: ['specialTitle'],
  });
export type SaveMenuRequest = z.input<typeof saveMenuRequestSchema>;

export const bulkSaveMenusRequestSchema = z.object({
  entries: z
    .array(
      z.object({
        mealDate: businessDateSchema,
        mealType: mealTypeSchema,
        items: z.array(menuItemInputSchema).max(40),
        version: z.number().int().min(1).optional(),
      }),
    )
    .min(1)
    .max(42),
});
export type BulkSaveMenusRequest = z.input<typeof bulkSaveMenusRequestSchema>;

export const copyMenuWeekRequestSchema = z.object({
  fromWeekStart: businessDateSchema,
  toWeekStart: businessDateSchema,
  overwrite: z.boolean().default(false),
});
export type CopyMenuWeekRequest = z.input<typeof copyMenuWeekRequestSchema>;

export const publishMenuResponseSchema = z.object({
  menu: adminMenuSchema,
  isChanged: z.boolean(),
  notifiedStudents: z.number().int(),
});
export type PublishMenuResponse = z.infer<typeof publishMenuResponseSchema>;
