import {
  type AuthSession,
  authSessionSchema,
  type LoginRequest,
  type RegisterRequest,
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
