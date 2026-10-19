import { authSessionSchema, type AuthSession } from '@ennel/shared';
import { type ZodType } from 'zod';
import { API_URL } from '@/config/env';
import { useSessionStore } from '../store/session.store';
import { readRefreshToken } from '../store/token-storage';
import { ApiError, ClientErrorCode } from './api-error';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions<T> {
  method?: Method;
  body?: unknown;
  formData?: FormData;
  /** Response schema; omit for 204 responses. */
  schema?: ZodType<T>;
  /** Send the access token and refresh once on 401. Default true. */
  isAuthenticated?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions<T> = {}): Promise<T> {
  const isAuthenticated = options.isAuthenticated ?? true;
  const response = await send(path, options, isAuthenticated);
  if (response.status === 401 && isAuthenticated && (await refreshSessionOnce())) {
    return parse(await send(path, options, true), options.schema);
  }
  return parse(response, options.schema);
}

async function send<T>(
  path: string,
  options: RequestOptions<T>,
  isAuthenticated: boolean,
): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = useSessionStore.getState().accessToken;
  if (isAuthenticated && token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    return await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body:
        options.formData ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
    });
  } catch {
    throw ApiError.network();
  }
}

async function parse<T>(response: Response, schema: ZodType<T> | undefined): Promise<T> {
  const body: unknown =
    response.status === 204 ? undefined : await response.json().catch(() => undefined);
  if (!response.ok) throw ApiError.fromResponse(response.status, body);
  if (!schema) return undefined as T;
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(
      ClientErrorCode.INVALID_RESPONSE,
      'Something went wrong. Please try again.',
      response.status,
    );
  }
  return parsed.data;
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * One refresh at a time: the server revokes the session if a refresh token is used twice
 * (ADR-0015), so parallel 401s must share a single refresh.
 */
export function refreshSessionOnce(): Promise<boolean> {
  refreshInFlight ??= refreshSession().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function refreshSession(): Promise<boolean> {
  const refreshToken = await readRefreshToken();
  if (!refreshToken) return false;
  try {
    const session: AuthSession = await apiRequest('/api/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      schema: authSessionSchema,
      isAuthenticated: false,
    });
    await useSessionStore.getState().setSession(session);
    return true;
  } catch (error) {
    // Keep the stored token on network errors so the student stays signed in offline.
    if (error instanceof ApiError && error.code === ClientErrorCode.NETWORK_ERROR) throw error;
    await useSessionStore.getState().signOut();
    return false;
  }
}
