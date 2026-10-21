import { stringify } from 'csv-stringify/sync';

// Spreadsheet apps run a cell starting with one of these as a formula (CSV injection, OWASP).
const FORMULA_START = /^[=+\-@\t\r]/;

/** Prefixes a quote to text a spreadsheet would treat as a formula, e.g. a staff-typed reason. */
export function neutralizeCell(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value;
}

/** CSV for staff downloads; every string cell is made formula-safe. */
export function toSafeCsv(rows: Record<string, string>[]): string {
  const safe = rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key, neutralizeCell(value)])),
  );
  return stringify(safe, { header: true });
}
