import {
  type AdminReport,
  adminReportSchema,
  type ReportExportJob,
  reportExportJobSchema,
  reportExportListSchema,
  type ReportFormat,
  type ReportQuery,
} from '@ennel/shared';
import { apiRequest, downloadFile } from '@/shared/api-client/api-client';

// Paths are relative to /api/v1/admin, which apiRequest adds.
export const getReport = (query: ReportQuery): Promise<AdminReport> =>
  apiRequest('/reports/summary', { query: { ...query }, schema: adminReportSchema });

export const downloadReport = (query: ReportQuery, format: ReportFormat): Promise<void> =>
  downloadFile(
    '/reports/export',
    { ...query, format },
    `ennel-report-${query.from}-to-${query.to}.${format}`,
  );

export const requestReportExport = (
  query: ReportQuery,
  format: ReportFormat,
): Promise<ReportExportJob> =>
  apiRequest('/reports/exports', {
    method: 'POST',
    body: { ...query, format },
    schema: reportExportJobSchema,
  });

export const listReportExports = async (): Promise<ReportExportJob[]> =>
  (await apiRequest('/reports/exports', { schema: reportExportListSchema })).items;

export const downloadReportExport = (job: ReportExportJob): Promise<void> =>
  downloadFile(`/reports/exports/${job.id}/download`, {}, job.fileName);
