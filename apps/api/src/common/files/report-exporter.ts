import { Injectable } from '@nestjs/common';
import { type ReportFormat } from '@ennel/shared';
import { stringify } from 'csv-stringify/sync';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export type ReportCell = string | number | null;

export interface ReportTable {
  title: string;
  note?: string;
  columns: string[];
  rows: ReportCell[][];
}

/** The one row model behind every export format (architecture §4.2). */
export interface ReportDocument {
  fileName: string;
  title: string;
  subtitle: string;
  tables: ReportTable[];
}

export interface ExportedFile {
  fileName: string;
  contentType: string;
  data: Buffer;
}

const CONTENT_TYPES: Record<ReportFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);
const SHEET_NAME_MAX = 31;
const PDF_MARGIN = 36;
const PDF_ROW_HEIGHT = 18;
const PRIMARY = '#0B5D46';
const MINT = '#E7F4EC';
const MUTED = '#5B6B64';

/** Spreadsheets run a cell starting with these as a formula, so a typed name could carry one. */
const FORMULA_START = /^[=+\-@\t\r]/;

export function neutralizeCsvCell(cell: ReportCell): ReportCell {
  return typeof cell === 'string' && FORMULA_START.test(cell) ? `'${cell}` : cell;
}

/** Excel forbids some characters in sheet names and repeats; both would fail the whole file. */
export function sheetName(title: string, used: Set<string>): string {
  const clean = title.replace(/[\\/*?:[\]]/g, ' ').slice(0, SHEET_NAME_MAX);
  let name = clean;
  for (let copy = 2; used.has(name.toLowerCase()); copy += 1) {
    const suffix = ` ${copy}`;
    name = `${clean.slice(0, SHEET_NAME_MAX - suffix.length)}${suffix}`;
  }
  used.add(name.toLowerCase());
  return name;
}

/** Renders a report as CSV, XLSX or PDF (Admin §N, §O). */
@Injectable()
export class ReportExporter {
  async render(report: ReportDocument, format: ReportFormat): Promise<ExportedFile> {
    return {
      fileName: `${report.fileName}.${format}`,
      contentType: CONTENT_TYPES[format],
      data: await this.renderData(report, format),
    };
  }

  private renderData(report: ReportDocument, format: ReportFormat): Promise<Buffer> {
    if (format === 'csv') return Promise.resolve(toCsv(report));
    return format === 'xlsx' ? toXlsx(report) : toPdf(report);
  }
}

function toCsv(report: ReportDocument): Buffer {
  const lines: ReportCell[][] = [[report.title], [report.subtitle]];
  for (const table of report.tables) {
    lines.push([], [table.title]);
    if (table.note) lines.push([table.note]);
    lines.push(table.columns, ...table.rows);
  }
  const rows = lines.map((line) => line.map(neutralizeCsvCell));
  // The byte-order mark makes Excel read the file as UTF-8.
  return Buffer.from(BYTE_ORDER_MARK + stringify(rows), 'utf8');
}

async function toXlsx(report: ReportDocument): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const used = new Set<string>();
  for (const table of report.tables) {
    const sheet = workbook.addWorksheet(sheetName(table.title, used));
    sheet.addRow([report.title]).font = { bold: true };
    sheet.addRow([report.subtitle]);
    if (table.note) sheet.addRow([table.note]);
    sheet.addRow([]);
    const header = sheet.addRow(table.columns);
    header.font = { bold: true };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7F4EC' } };
    table.rows.forEach((row) => sheet.addRow(row));
    table.columns.forEach((column, index) => {
      sheet.getColumn(index + 1).width = Math.max(12, column.length + 4);
    });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function toPdf(report: ReportDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'A4', layout: 'landscape', margin: PDF_MARGIN });
    const chunks: Buffer[] = [];
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
    pdf.fillColor(PRIMARY).fontSize(16).font('Helvetica-Bold').text(report.title);
    pdf.fillColor(MUTED).fontSize(10).font('Helvetica').text(report.subtitle);
    report.tables.forEach((table) => drawPdfTable(pdf, table));
    pdf.end();
  });
}

function drawPdfTable(pdf: PDFKit.PDFDocument, table: ReportTable): void {
  const bottom = () => pdf.page.height - PDF_MARGIN;
  // Keep the title with at least its header and one row.
  if (pdf.y + PDF_ROW_HEIGHT * 4 > bottom()) pdf.addPage();
  pdf.moveDown();
  pdf.fillColor(PRIMARY).fontSize(12).font('Helvetica-Bold').text(table.title, PDF_MARGIN);
  if (table.note) pdf.fillColor(MUTED).fontSize(9).font('Helvetica').text(table.note, PDF_MARGIN);
  pdf.moveDown(0.3);
  drawPdfRow(pdf, table.columns, true);
  for (const row of table.rows) {
    if (pdf.y + PDF_ROW_HEIGHT > bottom()) {
      pdf.addPage();
      drawPdfRow(pdf, table.columns, true);
    }
    drawPdfRow(pdf, row, false);
  }
  if (table.rows.length === 0) {
    pdf.fillColor(MUTED).fontSize(9).font('Helvetica').text('No data.', PDF_MARGIN);
  }
}

function drawPdfRow(pdf: PDFKit.PDFDocument, cells: ReportCell[], isHeader: boolean): void {
  const width = pdf.page.width - PDF_MARGIN * 2;
  const columnWidth = width / Math.max(1, cells.length);
  const top = pdf.y;
  if (isHeader) pdf.rect(PDF_MARGIN, top, width, PDF_ROW_HEIGHT).fill(MINT);
  pdf
    .fontSize(9)
    .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
    .fillColor('#14201B');
  cells.forEach((cell, index) => {
    pdf.text(String(cell ?? ''), PDF_MARGIN + index * columnWidth + 4, top + 5, {
      width: columnWidth - 8,
      height: PDF_ROW_HEIGHT - 6,
      ellipsis: true,
      lineBreak: false,
    });
  });
  pdf.x = PDF_MARGIN;
  pdf.y = top + PDF_ROW_HEIGHT;
}
