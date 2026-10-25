import { Injectable } from '@nestjs/common';
import { type ErrorCode } from '@ennel/shared';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { AppError } from '../errors/app-error';

export interface ParsedSheet {
  headers: string[];
  rows: string[][];
  format: 'csv' | 'xlsx';
}

export interface SpreadsheetLimits {
  /** Used in messages, e.g. "roster" → "Choose a CSV or XLSX roster file." */
  fileLabel: string;
  /** What a row is, e.g. "students" → "The file has a header row but no students." */
  rowNoun: string;
  maxBytes: number;
  maxRows: number;
  errorCode: ErrorCode;
}

const XLSX_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

type Invalid = (message: string) => AppError;

/**
 * Reads the first sheet of an XLSX workbook or a CSV file into header + rows of text. Shared by
 * the roster import (Admin §G) and the attendance import (Admin §I).
 */
@Injectable()
export class SpreadsheetReader {
  async read(
    data: Buffer | undefined,
    fileName: string,
    limits: SpreadsheetLimits,
  ): Promise<ParsedSheet> {
    const invalid: Invalid = (message) => new AppError(limits.errorCode, message);
    if (!data || data.length === 0) {
      throw invalid(`Choose a CSV or XLSX ${limits.fileLabel} file.`);
    }
    if (data.length > limits.maxBytes) {
      throw invalid(`The file must be ${Math.round(limits.maxBytes / 1024 / 1024)} MB or smaller.`);
    }
    const isXlsx = data.subarray(0, 4).equals(XLSX_SIGNATURE);
    if (!isXlsx && /\.xlsx?$/i.test(fileName)) throw invalid('This XLSX file could not be read.');
    const table = isXlsx ? await readXlsx(data, invalid) : readCsv(data, invalid);
    const [headers = [], ...rows] = table.filter((row) => row.some((cell) => cell.trim() !== ''));
    if (headers.length === 0) throw invalid('The file is empty.');
    if (rows.length === 0) throw invalid(`The file has a header row but no ${limits.rowNoun}.`);
    if (rows.length > limits.maxRows) {
      throw invalid(`Import at most ${limits.maxRows} rows at a time.`);
    }
    return { headers, rows, format: isXlsx ? 'xlsx' : 'csv' };
  }
}

function readCsv(data: Buffer, invalid: Invalid): string[][] {
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

async function readXlsx(data: Buffer, invalid: Invalid): Promise<string[][]> {
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
