import { Module } from '@nestjs/common';
import { ReportExporter } from '../../../common/files/report-exporter';
import { AdminReportsController } from './controllers/admin-reports.controller';
import { AdminReportsRepository } from './repositories/admin-reports.repository';
import { BuildReportService } from './services/build-report.service';
import { ReportExportsService } from './services/report-exports.service';

/** Reports, analytics and exports (Admin §O, Phase 11). The worker builds background exports. */
@Module({
  controllers: [AdminReportsController],
  providers: [AdminReportsRepository, BuildReportService, ReportExportsService, ReportExporter],
  exports: [ReportExportsService],
})
export class AdminReportsModule {}
