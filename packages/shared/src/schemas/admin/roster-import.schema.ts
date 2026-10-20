import { z } from 'zod';
import { referenceNumberSchema } from '../auth.schema.js';
import { paginationQuerySchema, uuidSchema } from '../common.schema.js';
import { profileFieldSchemas } from '../profile.schema.js';

/**
 * Roster file columns (Admin §G). Headers are matched case-insensitively, ignoring spaces
 * and underscores, so "Reference Number" and "reference_number" both work.
 */
export const ROSTER_IMPORT_COLUMNS = [
  'referenceNumber',
  'fullName',
  'department',
  'academicYear',
  'hostel',
  'block',
  'roomNumber',
  'email',
] as const;
export type RosterImportColumn = (typeof ROSTER_IMPORT_COLUMNS)[number];

export const ROSTER_REQUIRED_COLUMNS: readonly RosterImportColumn[] = [
  'referenceNumber',
  'fullName',
  'department',
  'academicYear',
];

export const ROSTER_IMPORT_MAX_ROWS = 5000;
export const ROSTER_IMPORT_MAX_BYTES = 5 * 1024 * 1024;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value));

/** One roster row after header mapping; hostel and block must name an existing block. */
export const rosterRowSchema = z
  .object({
    referenceNumber: referenceNumberSchema,
    fullName: profileFieldSchemas.fullName,
    department: profileFieldSchemas.department,
    academicYear: profileFieldSchemas.academicYear,
    hostel: optionalText(120),
    block: optionalText(120),
    roomNumber: optionalText(20),
    email: z
      .string()
      .trim()
      .transform((value) => (value === '' ? null : value.toLowerCase()))
      .pipe(z.email('Enter a valid email address').nullable()),
  })
  .refine((row) => (row.hostel === null) === (row.block === null), {
    message: 'Give both hostel and block, or neither',
    path: ['block'],
  });
export type RosterRow = z.output<typeof rosterRowSchema>;

export const ROSTER_ROW_OUTCOMES = [
  'VALID',
  'INVALID',
  'DUPLICATE_IN_FILE',
  'EXISTING_UNCHANGED',
  'EXISTING_UPDATE',
] as const;
export type RosterRowOutcome = (typeof ROSTER_ROW_OUTCOMES)[number];

/** Outcomes that block confirmation (ROSTER_IMPORT_INVALID). */
export const BLOCKING_ROSTER_OUTCOMES: readonly RosterRowOutcome[] = [
  'INVALID',
  'DUPLICATE_IN_FILE',
];

export const rosterImportSummarySchema = z.object({
  id: uuidSchema,
  status: z.string(),
  fileName: z.string(),
  totalRows: z.number().int(),
  counts: z.record(z.enum(ROSTER_ROW_OUTCOMES), z.number().int()),
  canConfirm: z.boolean(),
  createdAt: z.iso.datetime(),
  createdByName: z.string().nullable(),
  confirmedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
});
export type RosterImportSummary = z.infer<typeof rosterImportSummarySchema>;

export const rosterImportRowSchema = z.object({
  rowNumber: z.number().int(),
  outcome: z.enum(ROSTER_ROW_OUTCOMES),
  raw: z.record(z.string(), z.string()),
  errors: z.array(z.object({ field: z.string(), message: z.string() })),
  changes: z.array(z.string()),
});
export type RosterImportRow = z.infer<typeof rosterImportRowSchema>;

export const rosterImportRowsQuerySchema = paginationQuerySchema.extend({
  outcome: z.enum(ROSTER_ROW_OUTCOMES).optional(),
});
export type RosterImportRowsQuery = z.input<typeof rosterImportRowsQuerySchema>;
