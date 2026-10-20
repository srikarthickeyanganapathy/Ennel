import { Injectable } from '@nestjs/common';
import {
  BLOCKING_ROSTER_OUTCOMES,
  ErrorCode,
  ROSTER_IMPORT_COLUMNS,
  type RosterImportSummary,
} from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';
import { Clock } from '../../../../infrastructure/clock/clock';
import {
  type TransactionClient,
  TransactionRunner,
} from '../../../../infrastructure/database/transaction-runner';
import { GetMessPolicyService } from '../../../mess-config/services/get-mess-policy.service';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { type ClassifiedRow, classifyRosterRows } from '../domain/roster-import';
import {
  RosterImportRepository,
  type RosterUpsert,
  type StoredImportRow,
} from '../repositories/roster-import.repository';
import { GetRosterImportService } from './get-roster-import.service';

const IMPORT_TIMEOUT_MS = 120_000;

/**
 * Step 2 of the roster import (Admin §G). Rows are classified again against the current
 * roster inside the transaction, so a change since the preview cannot slip through. Any
 * blocking row aborts with ROSTER_IMPORT_INVALID and nothing is written. Roster entries not in
 * the file are left unchanged.
 */
@Injectable()
export class ConfirmRosterImportService {
  constructor(
    private readonly imports: RosterImportRepository,
    private readonly policy: GetMessPolicyService,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly clock: Clock,
    private readonly getImport: GetRosterImportService,
  ) {}

  async execute(id: string): Promise<RosterImportSummary> {
    const before = await this.getImport.summary(id);
    if (!before.canConfirm) throw this.cannotConfirm(before.status);
    const { collegeControlledFields } = await this.policy.execute();
    await this.transactions.run(
      async (tx) => {
        const now = this.clock.now();
        const stored = await this.imports.claimForConfirm(id, now, tx);
        if (!stored) throw this.cannotConfirm('PROCESSING');
        const rows = await this.reclassify(stored, tx);
        const blocking = rows.filter((row) => BLOCKING_ROSTER_OUTCOMES.includes(row.outcome));
        if (blocking.length > 0) {
          throw new AppError(
            ErrorCode.ROSTER_IMPORT_INVALID,
            'The roster changed since the preview. Upload the file again.',
            {
              rows: blocking.map((row) => row.rowNumber),
            },
          );
        }
        const entries = toUpserts(
          rows.filter((row) => row.outcome === 'VALID' || row.outcome === 'EXISTING_UPDATE'),
        );
        await this.imports.upsertEntries(entries, id, collegeControlledFields, tx);
        await this.imports.complete(id, now, tx);
        await this.audit.write(tx, {
          action: 'roster-import.confirm',
          entityType: 'import_job',
          entityId: id,
          after: summarizeOutcomes(rows),
        });
      },
      { timeoutMs: IMPORT_TIMEOUT_MS },
    );
    return this.getImport.summary(id);
  }

  private async reclassify(
    stored: StoredImportRow[],
    tx: TransactionClient,
  ): Promise<ClassifiedRow[]> {
    const columns = [...ROSTER_IMPORT_COLUMNS];
    const cells = stored.map((row) => columns.map((column) => row.raw[column] ?? ''));
    const references = stored.map((row) => (row.raw.referenceNumber ?? '').replace(/[\s-]/g, ''));
    const [existing, blocks] = await Promise.all([
      this.imports.loadExisting(references, tx),
      this.imports.loadBlocks(tx),
    ]);
    const rows = classifyRosterRows(columns, cells, existing, blocks);
    return rows.map((row, index) => ({
      ...row,
      rowNumber: stored[index]?.rowNumber ?? row.rowNumber,
    }));
  }

  private cannotConfirm(status: string): AppError {
    return new AppError(
      ErrorCode.ROSTER_IMPORT_INVALID,
      status === 'VALIDATED'
        ? 'Fix the rows with errors or duplicates and upload the file again.'
        : 'This import has already been confirmed.',
    );
  }
}

function toUpserts(rows: ClassifiedRow[]): RosterUpsert[] {
  return rows.flatMap((row) =>
    row.value
      ? [
          {
            referenceNumber: row.value.referenceNumber,
            fullName: row.value.fullName,
            department: row.value.department,
            academicYear: row.value.academicYear,
            hostelBlockId: row.value.hostelBlockId,
            roomNumber: row.value.roomNumber,
            email: row.value.email,
          },
        ]
      : [],
  );
}

function summarizeOutcomes(rows: ClassifiedRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.outcome] = (counts[row.outcome] ?? 0) + 1;
  return counts;
}
