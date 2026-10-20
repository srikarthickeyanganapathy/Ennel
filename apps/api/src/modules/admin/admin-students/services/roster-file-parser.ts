import { Injectable } from '@nestjs/common';
import { ErrorCode, ROSTER_IMPORT_MAX_BYTES, ROSTER_IMPORT_MAX_ROWS } from '@ennel/shared';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { AppError } from '../../../../common/errors/app-error';

export interface ParsedSheet {
  headers: string[];
  rows: string[][];
  format: 'csv' | 'xlsx';
}

const XLSX_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

function invalid(message: string): AppError {
  return new AppError(ErrorCode.ROSTER_IMPORT_INVALID, message);
}

/** Reads the first sheet of an XLSX workbook or a CSV file into header + rows of text (Admin §G). */
@Injectable()
export class RosterFileParser {
  async parse(data: Buffer | undefined, fileName: string): Promise<ParsedSheet> {
    if (!data || data.length === 0) throw invalid('Choose a CSV or XLSX roster file.');
    if (data.length > ROSTER_IMPORT_MAX_BYTES) throw invalid('The file must be 5 MB or smaller.');
    const isXlsx = data.subarray(0, 4).equals(XLSX_SIGNATURE);
    if (!isXlsx && /\.xlsx?$/i.test(fileName)) throw invalid('This XLSX file could not be read.');
    const table = isXlsx ? await this.readXlsx(data) : this.readCsv(data);
    const [headers = [], ...rows] = table.filter((row) => row.some((cell) => cell.trim() !== ''));
    if (headers.length === 0) throw invalid('The file is empty.');
    if (rows.length === 0) throw invalid('The file has a header row but no students.');
    if (rows.length > ROSTER_IMPORT_MAX_ROWS) {
      throw invalid(`Import at most ${ROSTER_IMPORT_MAX_ROWS} rows at a time.`);
    }
    return { headers, rows, format: isXlsx ? 'xlsx' : 'csv' };
  }

  private readCsv(data: Buffer): string[][] {
    try {
      return parse(data, {
        bom: true,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true,
      }) as string[][];
    } catch {
      throw invalid('This CSV file could not be read. Check that it is comma-separated text.');
    }
  }

  private async readXlsx(data: Buffer): Promise<string[][]> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(data as unknown as ArrayBuffer);
    } catch {
      throw invalid('This XLSX file could not be read.');
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) throw invalid('The workbook has no sheets.');
    const table: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      for (let column = 1; column <= sheet.columnCount; column += 1) {
        cells.push(row.getCell(column).text.trim());
      }
      table.push(cells);
    });
    return table;
  }
}
