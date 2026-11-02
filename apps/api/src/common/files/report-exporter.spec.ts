import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  neutralizeCsvCell,
  type ReportDocument,
  ReportExporter,
  sheetName,
} from './report-exporter';

const REPORT: ReportDocument = {
  fileName: 'report',
  title: 'Report',
  subtitle: '1 – 7 Nov 2026',
  tables: [
    {
      title: 'By meal',
      note: 'Plates',
      columns: ['Meal', 'Served'],
      rows: [
        ['Lunch', 12],
        ['=HYPERLINK("x")', null],
      ],
    },
    { title: 'By meal', columns: ['Empty'], rows: [] },
  ],
};

describe('ReportExporter (Admin §O)', () => {
  const exporter = new ReportExporter();

  it('neutralizes spreadsheet formulas in CSV cells, leaving numbers alone', async () => {
    expect(neutralizeCsvCell('=1+1')).toBe("'=1+1");
    expect(neutralizeCsvCell('-5')).toBe("'-5");
    expect(neutralizeCsvCell(-5)).toBe(-5);
    const file = await exporter.render(REPORT, 'csv');
    expect(file.fileName).toBe('report.csv');
    const text = file.data.toString('utf8');
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain('Lunch,12');
    expect(text).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it('writes a sheet per table with numbers as numbers, even with a repeated title', async () => {
    const file = await exporter.render(REPORT, 'xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.data as never);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['By meal', 'By meal 2']);
    const cells = workbook.worksheets[0]?.getRow(6).values as unknown[];
    expect(cells).toContain(12);
  });

  it('makes a PDF, including a table long enough to need more pages', async () => {
    const rows = Array.from({ length: 120 }, (_, index) => [`Row ${index}`, index]);
    const file = await exporter.render(
      { ...REPORT, tables: [{ title: 'Long', columns: ['A', 'B'], rows }] },
      'pdf',
    );
    expect(file.contentType).toBe('application/pdf');
    expect(file.data.subarray(0, 5).toString()).toBe('%PDF-');
    expect(file.data.toString('latin1').match(/\/Type \/Page\b/g)?.length).toBeGreaterThan(1);
  });

  it('keeps sheet names legal and unique', () => {
    const used = new Set<string>();
    expect(sheetName('A/B: C', used)).toBe('A B  C');
    expect(sheetName('A/B: C', used)).toBe('A B  C 2');
    expect(sheetName('x'.repeat(40), used)).toHaveLength(31);
  });
});
