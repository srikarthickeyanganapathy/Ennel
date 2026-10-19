import { useSessionStore } from '../store/session.store';
import { writeRefreshToken } from '../store/token-storage';
import { apiRequest } from './api-client';
import { ApiError } from './api-error';

const SESSION = {
  accessToken: 'new-access',
  accessTokenExpiresAt: '2026-10-19T06:00:00.000Z',
  refreshToken: 'new-refresh-token-long-enough',
  refreshTokenExpiresAt: '2026-11-18T06:00:00.000Z',
  isOnboardingComplete: true,
};

function jsonResponse(status: number, body: unknown): Response {
  return { status, ok: status < 400, json: async () => body } as Response;
}

describe('apiRequest', () => {
  const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>();

  beforeEach(async () => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    useSessionStore.setState({ status: 'signedIn', accessToken: 'expired-access' });
    await writeRefreshToken('old-refresh-token-long-enough');
  });

  it('refreshes once for parallel 401s, then retries with the new token (ADR-0015)', async () => {
    fetchMock.mockImplementation(async (url, init) => {
      if (url.endsWith('/auth/refresh')) return jsonResponse(200, SESSION);
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === 'Bearer new-access' ? jsonResponse(200, { ok: true }) : jsonResponse(401, {});
    });

    await Promise.all([apiRequest('/api/v1/me'), apiRequest('/api/v1/hostels')]);

    const refreshCalls = fetchMock.mock.calls.filter(([url]) => url.endsWith('/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
    expect(useSessionStore.getState().accessToken).toBe('new-access');
  });

  it('signs out when the refresh token is rejected', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(401, { code: 'UNAUTHENTICATED', message: 'Session ended', requestId: 'r' }),
    );
    await expect(apiRequest('/api/v1/me')).rejects.toBeInstanceOf(ApiError);
    expect(useSessionStore.getState().status).toBe('signedOut');
  });

  it('maps the standard error shape to ApiError', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(422, { code: 'SLOT_UNAVAILABLE', message: 'Slot is full', requestId: 'r' }),
    );
    await expect(apiRequest('/api/v1/x', { isAuthenticated: false })).rejects.toMatchObject({
      code: 'SLOT_UNAVAILABLE',
      message: 'Slot is full',
      status: 422,
    });
  });

  it('reports network failures with a friendly message', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(apiRequest('/api/v1/x', { isAuthenticated: false })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });
});
