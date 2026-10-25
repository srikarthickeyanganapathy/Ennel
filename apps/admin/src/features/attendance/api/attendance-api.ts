import {
  type AttendanceCounter,
  attendanceCounterSchema,
  type AttendanceImport,
  attendanceImportSchema,
  type AttendanceLookup,
  attendanceLookupSchema,
  type AttendanceWindowQuery,
  attendanceWindowQuerySchema,
  type MarkAttendanceRequest,
  type OutageStatus,
  outageStatusSchema,
} from '@ennel/shared';
import { apiRequest } from '@/shared/api-client/api-client';

// Paths are relative to /api/v1/admin, which apiRequest adds.
export const getActiveWindow = (): Promise<AttendanceWindowQuery> =>
  apiRequest('/attendance/active', { schema: attendanceWindowQuerySchema });

export const getCounter = (target: AttendanceWindowQuery): Promise<AttendanceCounter> =>
  apiRequest('/attendance/counter', { query: { ...target }, schema: attendanceCounterSchema });

export const lookupStudent = (
  target: AttendanceWindowQuery,
  referenceNumber: string,
): Promise<AttendanceLookup> =>
  apiRequest('/attendance/lookup', {
    query: { ...target, referenceNumber },
    schema: attendanceLookupSchema,
  });

export const markPresent = (body: MarkAttendanceRequest): Promise<AttendanceLookup> =>
  apiRequest('/attendance/marks', { method: 'POST', body, schema: attendanceLookupSchema });

export const getOutage = (): Promise<OutageStatus> =>
  apiRequest('/attendance/outage', { schema: outageStatusSchema });

export const setOutage = (isOn: boolean, reason: string): Promise<OutageStatus> =>
  apiRequest(`/attendance/outage/${isOn ? 'start' : 'end'}`, {
    method: 'POST',
    body: { reason },
    schema: outageStatusSchema,
  });

export const uploadAttendance = (
  target: AttendanceWindowQuery,
  file: File,
): Promise<AttendanceImport> => {
  const formData = new FormData();
  formData.append('file', file);
  return apiRequest('/attendance/imports', {
    method: 'POST',
    query: { ...target },
    formData,
    schema: attendanceImportSchema,
  });
};

export const confirmAttendanceImport = (id: string): Promise<AttendanceImport> =>
  apiRequest(`/attendance/imports/${id}/confirm`, {
    method: 'POST',
    schema: attendanceImportSchema,
  });
