import {
  type ChangePasswordRequest,
  type StaffLoginRequest,
  type StaffLoginResponse,
  staffLoginResponseSchema,
  type StaffMe,
  staffMeSchema,
  type StaffSession,
  staffSessionListSchema,
  staffSessionSchema,
  type StaffSessionItem,
  type TotpEnrollment,
  totpEnrollmentSchema,
  type TotpLoginRequest,
} from '@ennel/shared';
import { apiRequest } from '@/shared/api-client/api-client';

export const login = (body: StaffLoginRequest): Promise<StaffLoginResponse> =>
  apiRequest('/auth/login', { method: 'POST', body, schema: staffLoginResponseSchema });

export const verifyTotp = (body: TotpLoginRequest): Promise<StaffSession> =>
  apiRequest('/auth/totp/verify', { method: 'POST', body, schema: staffSessionSchema });

export const logout = (): Promise<void> => apiRequest('/auth/logout', { method: 'POST' });

export const getMe = (): Promise<StaffMe> => apiRequest('/auth/me', { schema: staffMeSchema });

export const changePassword = (body: ChangePasswordRequest): Promise<StaffSession> =>
  apiRequest('/auth/change-password', { method: 'POST', body, schema: staffSessionSchema });

export const listSessions = async (): Promise<StaffSessionItem[]> =>
  (await apiRequest('/auth/sessions', { schema: staffSessionListSchema })).items;

export const revokeAllSessions = (): Promise<void> =>
  apiRequest('/auth/sessions/revoke-all', { method: 'POST' });

export const enrollTotp = (): Promise<TotpEnrollment> =>
  apiRequest('/auth/totp/enroll', { method: 'POST', schema: totpEnrollmentSchema });

export const confirmTotp = (code: string): Promise<void> =>
  apiRequest('/auth/totp/confirm', { method: 'POST', body: { code } });
