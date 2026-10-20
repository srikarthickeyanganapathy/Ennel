import {
  ROSTER_IMPORT_COLUMNS,
  ROSTER_REQUIRED_COLUMNS,
  type RosterImportColumn,
  type RosterRow,
  type RosterRowOutcome,
  rosterRowSchema,
} from '@ennel/shared';

export interface ExistingRosterEntry {
  fullName: string;
  department: string;
  academicYear: number;
  hostelBlockId: string | null;
  roomNumber: string | null;
  email: string | null;
}

export interface RowIssue {
  field: string;
  message: string;
}

export interface ClassifiedRow {
  rowNumber: number;
  outcome: RosterRowOutcome;
  raw: Record<string, string>;
  errors: RowIssue[];
  /** Fields that differ from the existing entry, for EXISTING_UPDATE. */
  changes: string[];
  value: (RosterRow & { hostelBlockId: string | null }) | null;
}

const normalizeKey = (value: string) => value.toLowerCase().replace(/[\s_-]/g, '');
const COLUMN_BY_KEY = new Map(
  ROSTER_IMPORT_COLUMNS.map((column) => [normalizeKey(column), column]),
);

/** Maps file headers to known columns; unknown headers are ignored (Admin §G). */
export function mapHeaders(headers: string[]): {
  columns: (RosterImportColumn | null)[];
  missing: RosterImportColumn[];
} {
  const columns = headers.map((header) => COLUMN_BY_KEY.get(normalizeKey(header)) ?? null);
  const missing = ROSTER_REQUIRED_COLUMNS.filter((column) => !columns.includes(column));
  return { columns, missing };
}

export function blockKey(hostel: string, block: string): string {
  return `${hostel.trim().toLowerCase()}|${block.trim().toLowerCase()}`;
}

/**
 * Validate-first preview (Admin §G): every row is classified before anything is written.
 * Pure: existing entries and hostel blocks are passed in.
 */
export function classifyRosterRows(
  columns: (RosterImportColumn | null)[],
  rows: string[][],
  existing: ReadonlyMap<string, ExistingRosterEntry>,
  blocks: ReadonlyMap<string, string>,
): ClassifiedRow[] {
  const parsed = rows.map((cells, index) => parseRow(columns, cells, index + 2, blocks));
  const counts = countReferences(parsed);
  return parsed.map((row) => finalize(row, counts, existing));
}

function parseRow(
  columns: (RosterImportColumn | null)[],
  cells: string[],
  rowNumber: number,
  blocks: ReadonlyMap<string, string>,
): ClassifiedRow {
  const raw: Record<string, string> = {};
  columns.forEach((column, index) => {
    if (column) raw[column] = (cells[index] ?? '').trim();
  });
  const input = Object.fromEntries(
    ROSTER_IMPORT_COLUMNS.map((column) => [column, raw[column] ?? '']),
  );
  const result = rosterRowSchema.safeParse(input);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: String(issue.path[0] ?? 'row'),
      message: issue.message,
    }));
    return { rowNumber, outcome: 'INVALID', raw, errors, changes: [], value: null };
  }
  const { hostel, block } = result.data;
  const hostelBlockId = hostel && block ? (blocks.get(blockKey(hostel, block)) ?? null) : null;
  if (hostel && block && !hostelBlockId) {
    const errors = [{ field: 'block', message: `No block "${block}" in hostel "${hostel}"` }];
    return { rowNumber, outcome: 'INVALID', raw, errors, changes: [], value: null };
  }
  return {
    rowNumber,
    outcome: 'VALID',
    raw,
    errors: [],
    changes: [],
    value: { ...result.data, hostelBlockId },
  };
}

function countReferences(rows: ClassifiedRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const reference = row.value?.referenceNumber;
    if (reference) counts.set(reference, (counts.get(reference) ?? 0) + 1);
  }
  return counts;
}

function finalize(
  row: ClassifiedRow,
  counts: ReadonlyMap<string, number>,
  existing: ReadonlyMap<string, ExistingRosterEntry>,
): ClassifiedRow {
  if (!row.value) return row;
  const reference = row.value.referenceNumber;
  if ((counts.get(reference) ?? 0) > 1) {
    const errors = [
      {
        field: 'referenceNumber',
        message: 'This reference number appears more than once in the file',
      },
    ];
    return { ...row, outcome: 'DUPLICATE_IN_FILE', errors };
  }
  const current = existing.get(reference);
  if (!current) return row;
  const changes = diffEntry(current, row.value);
  return {
    ...row,
    outcome: changes.length > 0 ? 'EXISTING_UPDATE' : 'EXISTING_UNCHANGED',
    changes,
  };
}

function diffEntry(
  current: ExistingRosterEntry,
  next: RosterRow & { hostelBlockId: string | null },
): string[] {
  const fields = [
    'fullName',
    'department',
    'academicYear',
    'hostelBlockId',
    'roomNumber',
    'email',
  ] as const;
  return fields.filter((field) => current[field] !== next[field]);
}
