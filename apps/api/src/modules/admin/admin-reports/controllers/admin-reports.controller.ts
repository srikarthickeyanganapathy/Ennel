import { Body, Get, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import {
  type AdminReport,
  createReportExportRequestSchema,
  reportExportQuerySchema,
  type ReportExportJob,
  reportQuerySchema,
} from '@ennel/shared';
import { type Response } from 'express';
import { type z } from 'zod';
import {
  AdminController,
  RequirePermissions,
} from '../../../../common/decorators/admin.decorators';
import {
  type AuthenticatedStaff,
  CurrentStaff,
} from '../../../../common/decorators/current-staff.decorator';
import { type ExportedFile } from '../../../../common/files/report-exporter';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe';
import { BuildReportService } from '../services/build-report.service';
import { ReportExportsService } from '../services/report-exports.service';

function sendFile(response: Response, file: ExportedFile): void {
  response
    .setHeader('Content-Type', file.contentType)
    .setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`)
    .send(file.data);
}

/** Reports and exports (Admin §O). */
@AdminController('reports')
export class AdminReportsController {
  constructor(
    private readonly builder: BuildReportService,
    private readonly exports: ReportExportsService,
  ) {}

  @Get('summary')
  @RequirePermissions('reports:read')
  summary(
    @Query(new ZodValidationPipe(reportQuerySchema)) query: z.output<typeof reportQuerySchema>,
  ): Promise<AdminReport> {
    return this.builder.execute(query);
  }

  @Get('export')
  @RequirePermissions('reports:export')
  async export(
    @Query(new ZodValidationPipe(reportExportQuerySchema))
    query: z.output<typeof reportExportQuerySchema>,
    @Res() response: Response,
  ): Promise<void> {
    const { format, ...filters } = query;
    sendFile(response, await this.exports.direct(filters, format));
  }

  @Post('exports')
  @RequirePermissions('reports:export')
  requestExport(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Body(new ZodValidationPipe(createReportExportRequestSchema))
    body: z.output<typeof createReportExportRequestSchema>,
  ): Promise<ReportExportJob> {
    const { format, ...filters } = body;
    return this.exports.request(staff.id, filters, format);
  }

  @Get('exports')
  @RequirePermissions('reports:export')
  async listExports(
    @CurrentStaff() staff: AuthenticatedStaff,
  ): Promise<{ items: ReportExportJob[] }> {
    return { items: await this.exports.list(staff.id) };
  }

  @Get('exports/:id/download')
  @RequirePermissions('reports:export')
  async download(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ): Promise<void> {
    sendFile(response, await this.exports.download(staff.id, id));
  }
}
