import { Injectable } from '@nestjs/common';
import { type AuditLogItem, type Paginated } from '@ennel/shared';
import { type AuditLogFilter, AuditLogRepository } from '../repositories/audit-log.repository';

/** Admin §P viewer: newest first, filterable by actor, entity, action and date. */
@Injectable()
export class ListAuditLogsService {
  constructor(private readonly repository: AuditLogRepository) {}

  execute(
    filter: AuditLogFilter,
    page: number,
    pageSize: number,
  ): Promise<Paginated<AuditLogItem>> {
    return this.repository.list(filter, page, pageSize);
  }
}
