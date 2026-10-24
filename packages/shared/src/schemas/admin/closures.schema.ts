import { z } from 'zod';
import { businessDateSchema, overrideReasonSchema, uuidSchema } from '../common.schema.js';
import { mealTypeSchema } from '../meal-config.schema.js';

/** Admin §F closure kinds. */
export const CLOSURE_KINDS = ['MESS_CLOSED', 'FESTIVAL', 'MAINTENANCE'] as const;
export type ClosureKind = (typeof CLOSURE_KINDS)[number];

export const mealTypeListSchema = z
  .array(mealTypeSchema)
  .min(1, 'Choose at least one meal')
  .max(3)
  .refine((meals) => new Set(meals).size === meals.length, {
    message: 'Each meal can appear only once',
  });

export const adminClosureSchema = z.object({
  id: uuidSchema,
  date: businessDateSchema,
  mealTypes: z.array(mealTypeSchema),
  kind: z.enum(CLOSURE_KINDS),
  title: z.string(),
  reason: z.string(),
  status: z.enum(['ACTIVE', 'REMOVED']),
  createdByName: z.string(),
  createdAt: z.iso.datetime(),
  removedByName: z.string().nullable(),
  removedAt: z.iso.datetime().nullable(),
  removalReason: z.string().nullable(),
});
export type AdminClosure = z.infer<typeof adminClosureSchema>;

export const closureListQuerySchema = z.object({
  from: businessDateSchema.optional(),
  to: businessDateSchema.optional(),
  // Query strings are text: only "true" means yes (z.coerce.boolean would read "false" as true).
  includeRemoved: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});
export type ClosureListQuery = z.input<typeof closureListQuerySchema>;
export const closureListResponseSchema = z.object({ items: z.array(adminClosureSchema) });

/** How many booked meals a closure would cancel, shown before it is applied (Admin §F). */
export const closureImpactQuerySchema = z.object({
  date: businessDateSchema,
  mealTypes: z
    .string()
    .transform((value) => value.split(',').filter(Boolean))
    .pipe(mealTypeListSchema),
});
export type ClosureImpactQuery = z.input<typeof closureImpactQuerySchema>;
export const closureImpactSchema = z.object({
  meals: z.array(z.object({ mealType: mealTypeSchema, bookedCount: z.number().int() })),
  totalBooked: z.number().int(),
});
export type ClosureImpact = z.infer<typeof closureImpactSchema>;

export const createClosureRequestSchema = z.object({
  date: businessDateSchema,
  mealTypes: mealTypeListSchema,
  kind: z.enum(CLOSURE_KINDS),
  title: z.string().trim().min(2, 'Give the closure a short title').max(120),
  reason: overrideReasonSchema,
});
export type CreateClosureRequest = z.input<typeof createClosureRequestSchema>;

export const removeClosureRequestSchema = z.object({ reason: overrideReasonSchema });
export type RemoveClosureRequest = z.input<typeof removeClosureRequestSchema>;

export const closureResultSchema = z.object({
  closure: adminClosureSchema,
  /** Bookings marked "Mess closed" when applying. */
  cancelled: z.number().int(),
  /** ADR-0017 on removal: restored, moved to another slot, or left for the student to rebook. */
  restored: z.number().int(),
  notRestored: z.number().int(),
});
export type ClosureResult = z.infer<typeof closureResultSchema>;
