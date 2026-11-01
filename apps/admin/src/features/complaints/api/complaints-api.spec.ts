import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/shared/api-client/api-client';
import { closeWithReply } from './complaints-api';

vi.mock('@/shared/api-client/api-client', () => ({ apiRequest: vi.fn() }));

describe('closeWithReply (BR-CMP-4)', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockImplementation(async (_path, options) => {
      const body = options?.body as { status: string; version: number };
      return { status: body.status, version: body.version + 1 };
    });
  });

  it('moves a new report to In review first, then closes it with the next version', async () => {
    await closeWithReply({ id: 'c1', status: 'NEW', version: 2 }, 'RESOLVED', 'Fixed.');
    expect(vi.mocked(apiRequest).mock.calls.map(([, options]) => options?.body)).toEqual([
      { status: 'IN_REVIEW', version: 2 },
      { status: 'RESOLVED', response: 'Fixed.', version: 3 },
    ]);
  });

  it('closes a report already in review in one step', async () => {
    await closeWithReply(
      { id: 'c1', status: 'IN_REVIEW', version: 4 },
      'REJECTED',
      'Not our kitchen.',
    );
    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(apiRequest).toHaveBeenCalledWith(
      '/complaints/c1/status',
      expect.objectContaining({
        body: { status: 'REJECTED', response: 'Not our kitchen.', version: 4 },
      }),
    );
  });
});
