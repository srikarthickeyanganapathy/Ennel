import { Injectable } from '@nestjs/common';
import { stringify } from 'csv-stringify/sync';
import { type AuditLogFilter, AuditLogRepository } from '../repositories/audit-log.repository';

export const AUDIT_EXPORT_MAX_ROWS = 10_000;

export interface AuditExport {
  csv: string;
  isTruncated: boolean;
}

/** Admin §P export for AUDITOR and SUPER_ADMIN; large ranges are capped and flagged. */
@Injectable()
export class ExportAuditLogsService {
  constructor(private readonly repository: AuditLogRepository) {}

  async execute(filter: AuditLogFilter): Promise<AuditExport> {
    const result = await this.repository.list(filter, 1, AUDIT_EXPORT_MAX_ROWS);
    const rows = result.items.map((item) => ({
      createdAt: item.createdAt,
      actorName: item.actorName ?? item.actorType,
      actorRoles: item.actorRoles.join(' '),
      action: item.action,
      entityType: item.entityType,
      entityId: item.entityId,
      isOverride: item.isOverride ? 'yes' : 'no',
      reason: item.reason ?? '',
      before: item.before === null ? '' : JSON.stringify(item.before),
      after: item.after === null ? '' : JSON.stringify(item.after),
      ip: item.ip ?? '',
      requestId: item.requestId ?? '',
    }));
    return {
      csv: stringify(rows, { header: true }),
      isTruncated: result.total > AUDIT_EXPORT_MAX_ROWS,
    };
  }
}
