import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ErrorCode, type RosterImportSummary } from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';
import { TransactionRunner } from '../../../../infrastructure/database/transaction-runner';
import { FileStorageProvider } from '../../../../infrastructure/storage/file-storage.provider';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { classifyRosterRows, mapHeaders } from '../domain/roster-import';
import { RosterImportRepository } from '../repositories/roster-import.repository';
import { RosterFileParser } from './roster-file-parser';

export interface UploadedFile {
  buffer: Buffer | undefined;
  originalName: string;
}

/**
 * Step 1 of the roster import (Admin §G): parse, classify every row and store the preview.
 * Nothing in the roster changes until the import is confirmed.
 */
@Injectable()
export class UploadRosterImportService {
  constructor(
    private readonly parser: RosterFileParser,
    private readonly imports: RosterImportRepository,
    private readonly storage: FileStorageProvider,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
  ) {}

  async execute(file: UploadedFile, staffId: string): Promise<RosterImportSummary> {
    const data = file.buffer ?? Buffer.alloc(0);
    const sheet = await this.parser.parse(data, file.originalName);
    const { columns, missing } = mapHeaders(sheet.headers);
    if (missing.length > 0) {
      throw new AppError(
        ErrorCode.ROSTER_IMPORT_INVALID,
        `Missing required columns: ${missing.join(', ')}.`,
        {
          missingColumns: missing,
        },
      );
    }
    const [existing, blocks] = await Promise.all([
      this.imports.loadExisting(this.referenceCandidates(sheet.rows, columns)),
      this.imports.loadBlocks(),
    ]);
    const rows = classifyRosterRows(columns, sheet.rows, existing, blocks);

    const id = randomUUID();
    const storageKey = `imports/roster/${id}.${sheet.format}`;
    await this.storage.save(storageKey, data);
    const fileName = file.originalName.slice(0, 200);
    await this.transactions.run(
      async (tx) => {
        await this.imports.create({ id, fileName, storageKey, createdById: staffId, rows }, tx);
        await this.audit.write(tx, {
          action: 'roster-import.upload',
          entityType: 'import_job',
          entityId: id,
          after: { fileName, totalRows: rows.length },
        });
      },
      { timeoutMs: 60_000 },
    );
    const summary = await this.imports.findSummary(id);
    if (!summary) throw new AppError(ErrorCode.INTERNAL_ERROR, 'Import could not be saved.');
    return summary;
  }

  // Raw cells are normalized the same way the row schema does, to find existing entries.
  private referenceCandidates(
    rows: string[][],
    columns: ReturnType<typeof mapHeaders>['columns'],
  ): string[] {
    const index = columns.indexOf('referenceNumber');
    return rows
      .map((cells) => (cells[index] ?? '').replace(/[\s-]/g, ''))
      .filter((value) => value !== '');
  }
}
