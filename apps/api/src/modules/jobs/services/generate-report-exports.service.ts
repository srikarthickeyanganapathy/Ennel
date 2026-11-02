import { Injectable } from '@nestjs/common';
import { ReportExportsService } from '../../admin/admin-reports/services/report-exports.service';

export const GENERATE_REPORT_EXPORTS = 'generate-report-exports';

/** Runs every minute (Admin §O "large ranges run as background jobs"). */
@Injectable()
export class GenerateReportExportsService {
  constructor(private readonly exports: ReportExportsService) {}

  run(): Promise<{ finished: number; failed: number; stalled: number }> {
    return this.exports.runQueued();
  }
}
