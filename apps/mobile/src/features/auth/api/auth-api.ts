import {
  type AuthSession,
  authSessionSchema,
  type LoginRequest,
  type RegisterRequest,
  type ResetWithCodeRequest,
  type RosterCheckRequest,
  type RosterCheckResponse,
  rosterCheckResponseSchema,
} from '@ennel/shared';
import { apiRequest } from '@/shared/api-client/api-client';

export function checkRoster(body: RosterCheckRequest): Promise<RosterCheckResponse> {
  return apiRequest('/api/v1/auth/roster-check', {
    method: 'POST',
    body,
    schema: rosterCheckResponseSchema,
    isAuthenticated: false,
  });
}

export function registerStudent(body: RegisterRequest): Promise<AuthSession> {
  return apiRequest('/api/v1/auth/register', {
    method: 'POST',
    body,
    schema: authSessionSchema,
    isAuthenticated: false,
  });
}

export function loginStudent(body: LoginRequest): Promise<AuthSession> {
  return apiRequest('/api/v1/auth/login', {
    method: 'POST',
    body,
    schema: authSessionSchema,
    isAuthenticated: false,
  });
}

export function logoutStudent(refreshToken: string): Promise<void> {
  return apiRequest('/api/v1/auth/logout', {
    method: 'POST',
    body: { refreshToken },
    isAuthenticated: false,
  });
}

/** ADR-0019: completes a reset code issued by the mess office and signs the student in. */
export function resetPasswordWithCode(body: ResetWithCodeRequest): Promise<AuthSession> {
  return apiRequest('/api/v1/auth/reset-with-code', {
    method: 'POST',
    body,
    schema: authSessionSchema,
    isAuthenticated: false,
  });
}
