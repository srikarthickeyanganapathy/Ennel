import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { mockAuth } from '@/test-utils/mock-auth';
import { renderWithProviders } from '@/test-utils/render';
import { listAuditLogs } from '../api/audit-log-api';
import { AuditLogPage } from './AuditLogPage';

const auth = mockAuth(['audit-log:read']);
vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => auth,
  usePermissions:
    () =>
    (...keys: string[]) =>
      keys.every((key) => auth.permissions.has(key as never)),
}));
vi.mock('../api/audit-log-api', () => ({ listAuditLogs: vi.fn(), exportAuditLogs: vi.fn() }));

describe('AuditLogPage (Admin §P)', () => {
  it('filters whole IST days, including the last second of the To date', async () => {
    vi.mocked(listAuditLogs).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
    renderWithProviders(<AuditLogPage />);

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-20' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-20' } });

    await waitFor(() =>
      expect(listAuditLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({
          from: '2026-10-19T18:30:00.000Z',
          to: '2026-10-20T18:29:59.999Z',
        }),
      ),
    );
  });
});
