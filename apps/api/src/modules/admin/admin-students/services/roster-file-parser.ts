import { Injectable } from '@nestjs/common';
import { ErrorCode, ROSTER_IMPORT_MAX_BYTES, ROSTER_IMPORT_MAX_ROWS } from '@ennel/shared';
import { type ParsedSheet, SpreadsheetReader } from '../../../../common/files/spreadsheet-reader';

export type { ParsedSheet } from '../../../../common/files/spreadsheet-reader';

/** Reads a roster CSV or XLSX file (Admin §G) with the roster's limits and wording. */
@Injectable()
export class RosterFileParser {
  private readonly reader = new SpreadsheetReader();

  parse(data: Buffer | undefined, fileName: string): Promise<ParsedSheet> {
    return this.reader.read(data, fileName, {
      fileLabel: 'roster',
      rowNoun: 'students',
      maxBytes: ROSTER_IMPORT_MAX_BYTES,
      maxRows: ROSTER_IMPORT_MAX_ROWS,
      errorCode: ErrorCode.ROSTER_IMPORT_INVALID,
    });
  }
}
