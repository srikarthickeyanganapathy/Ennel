import { Global, Module } from '@nestjs/common';
import { AuditLogsController } from './controllers/audit-logs.controller';
import { AuditLogRepository, PrismaAuditLogRepository } from './repositories/audit-log.repository';
import { AuditWriter } from './services/audit-writer.service';
import { ExportAuditLogsService } from './services/export-audit-logs.service';
import { ListAuditLogsService } from './services/list-audit-logs.service';

/** Global so every admin use case can inject AuditWriter. */
@Global()
@Module({
  controllers: [AuditLogsController],
  providers: [
    { provide: AuditLogRepository, useClass: PrismaAuditLogRepository },
    AuditWriter,
    ListAuditLogsService,
    ExportAuditLogsService,
  ],
  exports: [AuditWriter],
})
export class AuditLogModule {}
