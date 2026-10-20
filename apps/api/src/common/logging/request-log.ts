export interface RequestLogEntry {
  method: string;
  url: string;
  status: number;
  durationMs: number;
  requestId: string;
  errorCode?: string;
}

/**
 * One readable line per request, e.g.
 * `POST /api/v1/auth/login → 401 INVALID_CREDENTIALS (35 ms) [req 4f1c…]`.
 * The query string is dropped because signed file URLs carry their signature there.
 * Bodies are never logged (they hold passwords and personal data).
 */
export function formatRequestLine(entry: RequestLogEntry): string {
  const path = entry.url.split('?')[0] ?? entry.url;
  const outcome = entry.errorCode ? `${entry.status} ${entry.errorCode}` : String(entry.status);
  return `${entry.method} ${path} → ${outcome} (${Math.round(entry.durationMs)} ms) [req ${entry.requestId}]`;
}

/** 4xx means the caller did something the API refused; 5xx is already logged with its stack. */
export function requestLogLevel(status: number): 'log' | 'warn' {
  return status >= 400 ? 'warn' : 'log';
}
