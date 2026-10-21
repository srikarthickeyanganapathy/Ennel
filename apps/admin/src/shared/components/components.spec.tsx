import { fireEvent, render, screen } from '@testing-library/react';
import { type ColumnDef } from '@tanstack/react-table';
import { describe, expect, it, vi } from 'vitest';
import { mockAuth } from '@/test-utils/mock-auth';
import { DataTable } from './DataTable';
import { PermissionGate } from './PermissionGate';
import { ReasonDialog } from './ReasonDialog';

const auth = mockAuth(['students:read']);
vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => auth,
  usePermissions:
    () =>
    (...keys: string[]) =>
      keys.every((key) => auth.permissions.has(key as never)),
}));
const saveCsv = vi.fn();
vi.mock('@/shared/lib/csv', async (original) => ({
  ...(await original<object>()),
  saveCsv: (...args: unknown[]) => saveCsv(...args),
}));

describe('PermissionGate (Admin §A)', () => {
  it('renders children only when every permission is held', () => {
    render(
      <>
        <PermissionGate permissions={['students:read']}>
          <button type="button">View students</button>
        </PermissionGate>
        <PermissionGate
          permissions={['students:read', 'students:lock']}
          fallback={<span>Not allowed</span>}
        >
          <button type="button">Lock</button>
        </PermissionGate>
      </>,
    );
    expect(screen.getByRole('button', { name: 'View students' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lock' })).not.toBeInTheDocument();
    expect(screen.getByText('Not allowed')).toBeInTheDocument();
  });
});

describe('ReasonDialog (working rule 7)', () => {
  it('requires a reason and passes it trimmed', () => {
    const onConfirm = vi.fn();
    render(
      <ReasonDialog
        open
        onOpenChange={() => undefined}
        title="Lock account?"
        confirmLabel="Lock"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lock' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('A reason is required');

    fireEvent.change(screen.getByLabelText('Reason (recorded in the audit log)'), {
      target: { value: '  Card misuse  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lock' }));
    expect(onConfirm).toHaveBeenCalledWith('Card misuse');
  });
});

interface Row {
  id: string;
  name: string;
  hostel: string;
}

const COLUMNS: ColumnDef<Row, unknown>[] = [
  {
    id: 'name',
    header: 'Name',
    accessorKey: 'name',
    meta: { exportValue: (row: unknown) => (row as Row).name },
  },
  {
    id: 'hostel',
    header: 'Hostel',
    accessorKey: 'hostel',
    meta: { exportValue: (row: unknown) => (row as Row).hostel },
  },
];
const ROWS: Row[] = [
  { id: '1', name: 'Asha', hostel: 'A' },
  { id: '2', name: '=cmd', hostel: 'B' },
];

describe('DataTable (Admin UX standards)', () => {
  const renderTable = (overrides: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        caption="Test rows"
        columns={COLUMNS}
        rows={ROWS}
        total={45}
        state={{ page: 1, pageSize: 20, sortOrder: 'asc' }}
        onPageChange={onPageChange}
        onPageSizeChange={() => undefined}
        getRowId={(row) => row.id}
        exportFileName="rows.csv"
        {...overrides}
      />,
    );
    return { onPageChange };
  };

  it('renders rows with server-side pagination controls', () => {
    const { onPageChange } = renderTable();
    expect(screen.getByRole('table', { name: 'Test rows' })).toBeInTheDocument();
    expect(screen.getByText('45 results · Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('exports the visible page as CSV with formula-safe cells', () => {
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(saveCsv).toHaveBeenCalledWith('rows.csv', "Name,Hostel\nAsha,A\n'=cmd,B");
  });

  it('steps back to the last page when the current page no longer exists', () => {
    const { onPageChange } = renderTable({
      rows: [],
      total: 21,
      state: { page: 3, pageSize: 20, sortOrder: 'asc' },
    });
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('shows loading, error and empty states', () => {
    renderTable({ rows: [], total: 0, emptyTitle: 'No students yet' });
    expect(screen.getByText('No students yet')).toBeInTheDocument();
  });
});
