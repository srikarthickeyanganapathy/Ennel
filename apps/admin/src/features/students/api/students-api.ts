import {
  type AdminHostel,
  adminHostelSchema,
  type AdminStudentDetail,
  adminStudentDetailSchema,
  type AdminStudentList,
  adminStudentListResponseSchema,
  type AdminStudentListQuery,
  type CredentialResetIssued,
  credentialResetIssuedSchema,
  type CredentialResetRequest,
  type Paginated,
  paginatedResponseSchema,
  type RosterImportRow,
  rosterImportRowSchema,
  type RosterImportRowsQuery,
  type RosterImportSummary,
  rosterImportSummarySchema,
  type UpdateAdminStudentRequest,
} from '@ennel/shared';
import { z } from 'zod';
import { apiRequest, downloadFile } from '@/shared/api-client/api-client';

export type StudentAccessAction = 'lock' | 'unlock' | 'deactivate' | 'reactivate';

export const listStudents = (query: AdminStudentListQuery): Promise<AdminStudentList> =>
  apiRequest('/students', { query: { ...query }, schema: adminStudentListResponseSchema });

export const getStudent = (id: string): Promise<AdminStudentDetail> =>
  apiRequest(`/students/${id}`, { schema: adminStudentDetailSchema });

export const updateStudent = (
  id: string,
  body: UpdateAdminStudentRequest,
): Promise<AdminStudentDetail> =>
  apiRequest(`/students/${id}`, { method: 'PATCH', body, schema: adminStudentDetailSchema });

export const changeStudentAccess = (
  id: string,
  action: StudentAccessAction,
  reason: string,
): Promise<AdminStudentDetail> =>
  apiRequest(`/students/${id}/${action}`, {
    method: 'POST',
    body: { reason },
    schema: adminStudentDetailSchema,
  });

export const issueCredentialReset = (
  id: string,
  body: CredentialResetRequest,
): Promise<CredentialResetIssued> =>
  apiRequest(`/students/${id}/credential-resets`, {
    method: 'POST',
    body,
    schema: credentialResetIssuedSchema,
  });

export const bulkUpdateHostel = (
  rosterEntryIds: string[],
  hostelBlockId: string,
  reason: string,
): Promise<{ updated: number }> =>
  apiRequest('/students/bulk-hostel', {
    method: 'POST',
    body: { rosterEntryIds, hostelBlockId, reason },
    schema: z.object({ updated: z.number() }),
  });

export const listHostels = async (): Promise<AdminHostel[]> =>
  (await apiRequest('/hostels', { schema: z.object({ items: z.array(adminHostelSchema) }) })).items;

export const uploadRoster = (file: File): Promise<RosterImportSummary> => {
  const formData = new FormData();
  formData.append('file', file);
  return apiRequest('/roster-imports', {
    method: 'POST',
    formData,
    schema: rosterImportSummarySchema,
  });
};

export const listRosterImports = (page: number): Promise<Paginated<RosterImportSummary>> =>
  apiRequest('/roster-imports', {
    query: { page, pageSize: 10 },
    schema: paginatedResponseSchema(rosterImportSummarySchema),
  });

export const getRosterImport = (id: string): Promise<RosterImportSummary> =>
  apiRequest(`/roster-imports/${id}`, { schema: rosterImportSummarySchema });

export const listRosterImportRows = (
  id: string,
  query: RosterImportRowsQuery,
): Promise<Paginated<RosterImportRow>> =>
  apiRequest(`/roster-imports/${id}/rows`, {
    query: { ...query },
    schema: paginatedResponseSchema(rosterImportRowSchema),
  });

export const confirmRosterImport = (id: string): Promise<RosterImportSummary> =>
  apiRequest(`/roster-imports/${id}/confirm`, {
    method: 'POST',
    schema: rosterImportSummarySchema,
  });

export const downloadRosterTemplate = (): Promise<void> =>
  downloadFile('/roster-imports/template', {}, 'roster-template.csv');
