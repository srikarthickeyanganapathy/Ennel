import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  ATTENDANCE_IMPORT_COLUMN,
  ATTENDANCE_IMPORT_MAX_ROWS,
  type AttendanceImport,
  type AttendanceWindowQuery,
  ErrorCode,
} from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';
import { SpreadsheetReader } from '../../../../common/files/spreadsheet-reader';
import { Clock } from '../../../../infrastructure/clock/clock';
import {
  type TransactionClient,
  TransactionRunner,
} from '../../../../infrastructure/database/transaction-runner';
import { FileStorageProvider } from '../../../../infrastructure/storage/file-storage.provider';
import { attendanceWindow, windowPhase } from '../../../attendance/domain/attendance-window';
import { AttendanceRepository } from '../../../attendance/repositories/attendance.repository';
import { AttendanceRecorder } from '../../../attendance/services/attendance-recorder.service';
import { BookingOutcomeService } from '../../../bookings/services/booking-outcome.service';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { classifyAttendanceRows, normaliseReference } from '../domain/attendance-import';
import { AdminAttendanceRepository } from '../repositories/admin-attendance.repository';
import { AttendanceCounterService } from './attendance-counter.service';

export interface UploadedSheet {
  buffer: Buffer | undefined;
  originalName: string;
}

const MAX_BYTES = 2 * 1024 * 1024;
const IMPORT_TIMEOUT_MS = 120_000;

/**
 * Admin §I attendance import for one meal window, validate-first like the roster (ADR-0025):
 * upload classifies every row; confirm writes IMPORT records for the VALID rows only.
 */
@Injectable()
export class AttendanceImportService {
  private readonly reader = new SpreadsheetReader();

  constructor(
    private readonly counter: AttendanceCounterService,
    private readonly attendance: AttendanceRepository,
    private readonly admin: AdminAttendanceRepository,
    private readonly recorder: AttendanceRecorder,
    private readonly outcomes: BookingOutcomeService,
    private readonly storage: FileStorageProvider,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly clock: Clock,
  ) {}

  async upload(
    file: UploadedSheet,
    window: AttendanceWindowQuery,
    staffId: string,
  ): Promise<AttendanceImport> {
    const meal = await this.counter.meal(window.mealType);
    if (windowPhase(attendanceWindow(window.date, meal), this.clock.now()) === 'BEFORE') {
      throw invalid('This meal has not started yet, so there is no attendance to import.');
    }
    const { references, format } = await this.readReferences(file);
    const states = await this.admin.studentWindowStates(
      window.date,
      meal.id,
      references.map(normaliseReference).filter(Boolean),
    );
    const rows = classifyAttendanceRows(references, states);
    const id = randomUUID();
    const storageKey = `imports/attendance/${id}.${format}`;
    await this.storage.save(storageKey, file.buffer ?? Buffer.alloc(0));
    const fileName = file.originalName.slice(0, 200);
    await this.transactions.run(async (tx) => {
      await this.admin.createImport(
        { id, fileName, storageKey, staffId, context: { ...window }, rows },
        tx,
      );
      await this.audit.write(tx, {
        action: 'attendance-import.upload',
        entityType: 'import_job',
        entityId: id,
        after: { fileName, ...window, totalRows: rows.length },
      });
    });
    return this.get(id);
  }

  async get(id: string): Promise<AttendanceImport> {
    const stored = await this.admin.findImport(id);
    if (!stored) throw new AppError(ErrorCode.NOT_FOUND, 'Import not found.');
    return stored.summary;
  }

  async confirm(id: string, staffId: string): Promise<AttendanceImport> {
    await this.transactions.run(
      async (tx) => {
        const stored = await this.admin.findImport(id, tx);
        if (!stored) throw new AppError(ErrorCode.NOT_FOUND, 'Import not found.');
        if (stored.summary.status !== 'VALIDATED')
          throw invalid('This import was already confirmed.');
        const { date, mealType } = stored.summary;
        const applied = await this.apply(
          id,
          stored.validStudentIds,
          { date, mealType },
          staffId,
          tx,
        );
        const now = this.clock.now();
        if (
          !(await this.admin.completeImport(id, { date, mealType, appliedRows: applied }, now, tx))
        ) {
          throw invalid('This import was already confirmed.');
        }
        await this.audit.write(tx, {
          action: 'attendance-import.confirm',
          entityType: 'import_job',
          entityId: id,
          after: { date, mealType, appliedRows: applied },
        });
      },
      { timeoutMs: IMPORT_TIMEOUT_MS },
    );
    return this.get(id);
  }

  /** Rows are re-checked at confirm time: a student marked meanwhile is simply skipped. */
  private async apply(
    importJobId: string,
    studentIds: string[],
    window: AttendanceWindowQuery,
    staffId: string,
    tx: TransactionClient,
  ): Promise<number> {
    const meal = await this.counter.meal(window.mealType, tx);
    const bookings = await this.attendance.windowBookings(window.date, meal.id, tx);
    const now = this.clock.now();
    let applied = 0;
    for (const studentId of studentIds) {
      const booking = bookings.find((item) => item.studentId === studentId);
      if (!booking || (booking.status !== 'BOOKED' && booking.status !== 'NO_SHOW')) continue;
      if (booking.status === 'NO_SHOW') {
        if (!(await this.admin.excludeHeldNoShow(booking.id, staffId, now, tx))) continue;
      }
      const outcome = await this.recorder.record(
        {
          studentId,
          date: window.date,
          mealId: meal.id,
          booking,
          source: 'IMPORT',
          verifiedAt: null,
          recordedAt: now,
          actor: { type: 'STAFF', staffId },
          importJobId,
        },
        tx,
      );
      if (outcome === 'ALREADY_RECORDED') continue;
      if (booking.status === 'NO_SHOW') {
        const ref = { id: booking.id, version: booking.version, status: 'NO_SHOW' as const };
        await this.outcomes.complete(ref, { type: 'STAFF', staffId }, tx);
      }
      applied += 1;
    }
    return applied;
  }

  private async readReferences(
    file: UploadedSheet,
  ): Promise<{ references: string[]; format: 'csv' | 'xlsx' }> {
    const sheet = await this.reader.read(file.buffer, file.originalName, {
      fileLabel: 'attendance',
      rowNoun: 'students',
      maxBytes: MAX_BYTES,
      maxRows: ATTENDANCE_IMPORT_MAX_ROWS,
      errorCode: ErrorCode.VALIDATION_FAILED,
    });
    const column = sheet.headers.findIndex(
      (header) => header.trim().toLowerCase().replace(/\s+/g, '_') === ATTENDANCE_IMPORT_COLUMN,
    );
    if (column === -1) throw invalid(`The file needs a "${ATTENDANCE_IMPORT_COLUMN}" column.`);
    return { references: sheet.rows.map((row) => row[column] ?? ''), format: sheet.format };
  }
}

function invalid(message: string): AppError {
  return new AppError(ErrorCode.VALIDATION_FAILED, message);
}
