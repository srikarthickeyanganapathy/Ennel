import { z } from 'zod';
import { ErrorCode } from '../errors/error-codes.js';
import { isBusinessDate } from '../time/business-time.js';

/** `YYYY-MM-DD` IST calendar date (ADR-0002). */
export const businessDateSchema = z
  .string()
  .refine(isBusinessDate, { message: 'Expected a valid date in YYYY-MM-DD format' });

export const uuidSchema = z.uuid();

/** Mandatory reason for admin overrides (working rule 7, BR-DEAD-7). */
export const overrideReasonSchema = z
  .string()
  .trim()
  .min(1, 'A reason is required')
  .max(500, 'Keep the reason under 500 characters');

export const SORT_ORDERS = ['asc', 'desc'] as const;

/** Shared list contract: docs/api-contract.md §1.1. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().trim().min(1).optional(),
  sortOrder: z.enum(SORT_ORDERS).default('asc'),
  q: z.string().trim().max(200).optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function paginatedResponseSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
  });
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

const ERROR_CODE_VALUES = Object.values(ErrorCode) as [ErrorCode, ...ErrorCode[]];

export const errorResponseSchema = z.object({
  code: z.enum(ERROR_CODE_VALUES),
  message: z.string(),
  details: z.unknown().optional(),
  requestId: z.string(),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
