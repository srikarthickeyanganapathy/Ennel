import { type StaffSession, staffSessionSchema } from '@ennel/shared';
import { type ZodType } from 'zod';
import { ApiError } from './api-error';

/** Same-origin in development through the Vite proxy, so the refresh cookie stays first-party. */
const ADMIN_API = '/api/v1/admin';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions<T> {
  method?: Method;
  body?: unknown;
  formData?: FormData;
  /** Primitive values become query parameters; empty, null and undefined are left out. */
  query?: Record<string, unknown>;
  schema?: ZodType<T>;
  /** Return the raw response (for file downloads). */
  isRaw?: boolean;
}

interface SessionHooks {
  onSession: (session: StaffSession) => void;
  onSignedOut: () => void;
}

// The access token lives only in memory; the refresh token is an httpOnly cookie (ADR-0015).
let accessToken: string | null = null;
let hooks: SessionHooks = { onSession: () => undefined, onSignedOut: () => undefined };
let refreshInFlight: Promise<StaffSession | null> | null = null;

export function configureSession(nextHooks: SessionHooks): void {
  hooks = nextHooks;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function buildUrl(path: string, query?: RequestOptions<unknown>['query']): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    const isPrimitive =
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
    if (isPrimitive && value !== '') params.set(key, String(value));
  }
  const search = params.toString();
  return `${ADMIN_API}${path}${search ? `?${search}` : ''}`;
}

async function send<T>(path: string, options: RequestOptions<T>): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    return await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      credentials: 'same-origin',
      body:
        options.formData ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Cannot reach the server. Check your connection.', 0);
  }
}

export async function apiRequest<T = void>(
  path: string,
  options: RequestOptions<T> = {},
): Promise<T> {
  let response = await send(path, options);
  if (response.status === 401 && !path.startsWith('/auth/') && (await refreshOnce())) {
    response = await send(path, options);
  }
  if (!response.ok) throw await ApiError.fromResponse(response);
  if (options.isRaw) return response as unknown as T;
  if (response.status === 204 || !options.schema) return undefined as T;
  const parsed = options.schema.safeParse(await response.json());
  if (!parsed.success)
    throw new ApiError('INVALID_RESPONSE', 'Unexpected response from the server.', response.status);
  return parsed.data;
}

/** One refresh at a time: refresh tokens are single-use (ADR-0015). */
export function refreshOnce(): Promise<StaffSession | null> {
  refreshInFlight ??= refresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function refresh(): Promise<StaffSession | null> {
  try {
    const session = await apiRequest('/auth/refresh', {
      method: 'POST',
      schema: staffSessionSchema,
    });
    setAccessToken(session.accessToken);
    hooks.onSession(session);
    return session;
  } catch (error) {
    if (error instanceof ApiError && error.code === 'NETWORK_ERROR') throw error;
    setAccessToken(null);
    hooks.onSignedOut();
    return null;
  }
}

/** Downloads a CSV (or other file) from an authenticated endpoint. */
export async function downloadFile(
  path: string,
  query: RequestOptions<unknown>['query'],
  fileName: string,
): Promise<void> {
  const response = await apiRequest<Response>(path, { query, isRaw: true });
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
