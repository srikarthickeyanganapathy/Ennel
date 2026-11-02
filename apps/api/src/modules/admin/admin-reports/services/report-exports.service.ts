import { Injectable, Logger } from '@nestjs/common';
import {
  ErrorCode,
  REPORT_DIRECT_EXPORT_MAX_DAYS,
  type ReportExportJob,
  type ReportFilters,
  type ReportFormat,
  reportQuerySchema,
} from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';
import { type ExportedFile, ReportExporter } from '../../../../common/files/report-exporter';
import { Clock } from '../../../../infrastructure/clock/clock';
import { TransactionRunner } from '../../../../infrastructure/database/transaction-runner';
import { FileStorageProvider } from '../../../../infrastructure/storage/file-storage.provider';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { reportDocument } from '../domain/report-document';
import {
  AdminReportsRepository,
  type ReportExportRow,
} from '../repositories/admin-reports.repository';
import { BuildReportService, daysInRange } from './build-report.service';

const EXPORTS_LISTED = 10;
const EXPORTS_PER_RUN = 5;
const STALLED_AFTER_MS = 15 * 60_000;
const CONTENT_TYPES: Record<string, string> = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

function toJob(row: ReportExportRow): ReportExportJob {
  const filters = reportQuerySchema.parse(row.filters);
  return {
    id: row.id,
    status: row.status,
    format: row.format as ReportFormat,
    from: filters.from,
    to: filters.to,
    fileName: row.fileName,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

/** Admin §O exports: short ranges download straight away, long ones run as a background job. */
@Injectable()
export class ReportExportsService {
  private readonly logger = new Logger(ReportExportsService.name);

  constructor(
    private readonly builder: BuildReportService,
    private readonly reports: AdminReportsRepository,
    private readonly exporter: ReportExporter,
    private readonly storage: FileStorageProvider,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly clock: Clock,
  ) {}

  private async render(filters: ReportFilters, format: ReportFormat): Promise<ExportedFile> {
    return this.exporter.render(reportDocument(await this.builder.execute(filters)), format);
  }

  async direct(filters: ReportFilters, format: ReportFormat): Promise<ExportedFile> {
    if (daysInRange(filters.from, filters.to) > REPORT_DIRECT_EXPORT_MAX_DAYS) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        `Ranges over ${REPORT_DIRECT_EXPORT_MAX_DAYS} days export in the background.`,
      );
    }
    return this.render(filters, format);
  }

  async request(
    staffId: string,
    filters: ReportFilters,
    format: ReportFormat,
  ): Promise<ReportExportJob> {
    this.builder.assertRange(filters);
    const row = await this.transactions.run(async (tx) => {
      const created = await this.reports.createExport(
        {
          requestedById: staffId,
          format,
          filters,
          fileName: `ennel-report-${filters.from}-to-${filters.to}.${format}`,
        },
        tx,
      );
      await this.audit.write(tx, {
        action: 'report.export.request',
        entityType: 'report_export',
        entityId: created.id,
        after: { format, filters },
      });
      return created;
    });
    return toJob(row);
  }

  async list(staffId: string): Promise<ReportExportJob[]> {
    return (await this.reports.listExports(staffId, EXPORTS_LISTED)).map(toJob);
  }

  /** Staff download only their own exports: a report may be filtered in ways a colleague chose. */
  async download(staffId: string, id: string): Promise<ExportedFile> {
    const row = await this.reports.findExport(id, staffId);
    const data = row?.fileKey ? await this.storage.read(row.fileKey) : null;
    if (!row || !data) throw new AppError(ErrorCode.NOT_FOUND, 'This export is not ready.');
    return {
      fileName: row.fileName,
      contentType: CONTENT_TYPES[row.format] ?? 'application/octet-stream',
      data,
    };
  }

  /** Runs in the worker. One failed export never stops the next. */
  async runQueued(): Promise<{ finished: number; failed: number; stalled: number }> {
    const now = this.clock.now();
    const stalled = await this.reports.failStalledExports(
      new Date(now.getTime() - STALLED_AFTER_MS),
      now,
    );
    let finished = 0;
    let failed = 0;
    for (const row of await this.reports.queuedExports(EXPORTS_PER_RUN)) {
      if (!(await this.reports.claimExport(row.id))) continue;
      try {
        const file = await this.render(
          reportQuerySchema.parse(row.filters),
          row.format as ReportFormat,
        );
        const fileKey = `report-exports/${row.id}.${row.format}`;
        await this.storage.save(fileKey, file.data);
        await this.reports.finishExport(row.id, this.clock.now(), { fileKey });
        finished += 1;
      } catch (error) {
        this.logger.error(`Report export ${row.id} failed`, error);
        await this.reports.finishExport(row.id, this.clock.now(), {
          error: 'The export could not be built. Please try again.',
        });
        failed += 1;
      }
    }
    return { finished, failed, stalled };
  }
}
