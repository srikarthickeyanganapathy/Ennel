import { Get, Header, Query, Res } from '@nestjs/common';
import { type AuditLogItem, auditLogQuerySchema, type Paginated } from '@ennel/shared';
import type { Response } from 'express';
import { type z } from 'zod';
import {
  AdminController,
  RequirePermissions,
} from '../../../../common/decorators/admin.decorators';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe';
import { ExportAuditLogsService } from '../services/export-audit-logs.service';
import { ListAuditLogsService } from '../services/list-audit-logs.service';

type AuditQuery = z.output<typeof auditLogQuerySchema>;

/** Read-only by design: no update or delete endpoint exists for audit logs (Admin §P). */
@AdminController('audit-logs')
export class AuditLogsController {
  constructor(
    private readonly listLogs: ListAuditLogsService,
    private readonly exportLogs: ExportAuditLogsService,
  ) {}

  @Get()
  @RequirePermissions('audit-log:read')
  list(
    @Query(new ZodValidationPipe(auditLogQuerySchema)) query: AuditQuery,
  ): Promise<Paginated<AuditLogItem>> {
    const { page, pageSize, ...filter } = query;
    return this.listLogs.execute(filter, page, pageSize);
  }

  @Get('export')
  @RequirePermissions('audit-log:export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="audit-log.csv"')
  async export(
    @Query(new ZodValidationPipe(auditLogQuerySchema)) query: AuditQuery,
    @Res() response: Response,
  ): Promise<void> {
    const { page: _page, pageSize: _pageSize, ...filter } = query;
    const result = await this.exportLogs.execute(filter);
    response.setHeader('X-Export-Truncated', String(result.isTruncated)).send(result.csv);
  }
}
