import { describe, expect, it } from 'vitest';
import { formatRequestLine, requestLogLevel } from './request-log';

describe('request log line', () => {
  it('shows method, path, status, error code, duration and request ID', () => {
    const line = formatRequestLine({
      method: 'POST',
      url: '/api/v1/auth/login',
      status: 401,
      durationMs: 35.4,
      requestId: 'req-0001',
      errorCode: 'INVALID_CREDENTIALS',
    });
    expect(line).toBe('POST /api/v1/auth/login → 401 INVALID_CREDENTIALS (35 ms) [req req-0001]');
  });

  it('drops the query string so signed URLs never reach the log', () => {
    const line = formatRequestLine({
      method: 'GET',
      url: '/api/v1/files/photos/a.jpg?exp=1&sig=secret',
      status: 200,
      durationMs: 3,
      requestId: 'req-0002',
    });
    expect(line).toBe('GET /api/v1/files/photos/a.jpg → 200 (3 ms) [req req-0002]');
    expect(line).not.toContain('secret');
  });

  it('warns on refused requests only', () => {
    expect(requestLogLevel(200)).toBe('log');
    expect(requestLogLevel(403)).toBe('warn');
  });
});
