import {
  type AuditLogItem,
  auditLogItemSchema,
  type AuditLogQuery,
  type Paginated,
  paginatedResponseSchema,
} from '@ennel/shared';
import { apiRequest, downloadFile } from '@/shared/api-client/api-client';

const auditPageSchema = paginatedResponseSchema(auditLogItemSchema);

export const listAuditLogs = (query: AuditLogQuery): Promise<Paginated<AuditLogItem>> =>
  apiRequest('/audit-logs', { query: { ...query }, schema: auditPageSchema });

export const exportAuditLogs = (query: AuditLogQuery): Promise<void> =>
  downloadFile(
    '/audit-logs/export',
    { ...query, page: undefined, pageSize: undefined },
    'audit-log.csv',
  );
