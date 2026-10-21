import { staffSessionListSchema } from '@ennel/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, configureSession } from './api-client';

const SESSION = {
  accessToken: 'new-token',
  accessTokenExpiresAt: '2026-10-21T06:00:00.000Z',
  mustChangePassword: false,
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const failure = (status: number, code: string) =>
  json(status, { code, message: `${code} message`, requestId: 'req-1' });

function mockFetch(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
const calledPaths = (fetchMock: ReturnType<typeof mockFetch>) =>
  fetchMock.mock.calls.map(([url]) => String(url));

afterEach(() => vi.unstubAllGlobals());

describe('apiRequest token refresh (ADR-0015)', () => {
  it('refreshes an expired token for authenticated auth routes such as the session list', async () => {
    const onSession = vi.fn();
    configureSession({ onSession, onSignedOut: () => undefined });
    const fetchMock = mockFetch(
      failure(401, 'UNAUTHENTICATED'),
      json(200, SESSION),
      json(200, { items: [] }),
    );

    await expect(apiRequest('/auth/sessions', { schema: staffSessionListSchema })).resolves.toEqual(
      { items: [] },
    );
    expect(calledPaths(fetchMock)).toEqual([
      '/api/v1/admin/auth/sessions',
      '/api/v1/admin/auth/refresh',
      '/api/v1/admin/auth/sessions',
    ]);
    expect(onSession).toHaveBeenCalledWith(SESSION);
  });

  it('does not refresh when the current password is wrong', async () => {
    const fetchMock = mockFetch(failure(401, 'INVALID_CREDENTIALS'));
    await expect(
      apiRequest('/auth/change-password', { method: 'POST', body: {} }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never refreshes for the sign-in route', async () => {
    const fetchMock = mockFetch(failure(401, 'UNAUTHENTICATED'));
    await expect(apiRequest('/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('signs out when the refresh itself fails', async () => {
    const onSignedOut = vi.fn();
    configureSession({ onSession: () => undefined, onSignedOut });
    mockFetch(failure(401, 'UNAUTHENTICATED'), failure(401, 'UNAUTHENTICATED'));
    await expect(apiRequest('/students')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(onSignedOut).toHaveBeenCalled();
  });
});
