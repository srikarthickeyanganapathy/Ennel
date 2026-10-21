import { type RosterImportSummary } from '@ennel/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test-utils/render';
import { listRosterImportRows, listRosterImports } from '../api/students-api';
import { RosterImportPage } from './RosterImportPage';

vi.mock('../api/students-api', () => ({
  confirmRosterImport: vi.fn(),
  downloadRosterTemplate: vi.fn(),
  listRosterImportRows: vi.fn(),
  listRosterImports: vi.fn(),
  uploadRoster: vi.fn(),
}));

const job = (id: string, fileName: string): RosterImportSummary => ({
  id,
  status: 'VALIDATED',
  fileName,
  totalRows: 2,
  counts: {
    VALID: 1,
    INVALID: 1,
    DUPLICATE_IN_FILE: 0,
    EXISTING_UNCHANGED: 0,
    EXISTING_UPDATE: 0,
  },
  canConfirm: false,
  createdAt: '2026-10-20T06:00:00.000Z',
  createdByName: 'Admin',
  confirmedAt: null,
  completedAt: null,
});
const FIRST = job('88888888-8888-4888-8888-888888888888', 'first.csv');
const SECOND = job('99999999-9999-4999-8999-999999999999', 'second.csv');

describe('RosterImportPage (Admin §G)', () => {
  it('starts each import preview with no result filter', async () => {
    vi.mocked(listRosterImports).mockResolvedValue({
      items: [FIRST, SECOND],
      total: 2,
      page: 1,
      pageSize: 10,
    });
    vi.mocked(listRosterImportRows).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 50,
    });
    renderWithProviders(<RosterImportPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'first.csv' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Error (1)' }));
    await waitFor(() =>
      expect(listRosterImportRows).toHaveBeenLastCalledWith(FIRST.id, {
        outcome: 'INVALID',
        page: 1,
        pageSize: 50,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'second.csv' }));
    await waitFor(() =>
      expect(listRosterImportRows).toHaveBeenLastCalledWith(SECOND.id, {
        outcome: undefined,
        page: 1,
        pageSize: 50,
      }),
    );
  });
});
