import { type AdminStudentListItem, type AdminStudentListQuery } from '@ennel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef, type RowSelectionState } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { DataTable, type DataTableColumnMeta } from '@/shared/components/DataTable';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { ReasonDialog } from '@/shared/components/ReasonDialog';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { Checkbox, Field, Input, Select } from '@/shared/components/ui/form-controls';
import { useTableState } from '@/shared/hooks/use-table-state';
import { PageHeader } from '@/shared/layout/PageHeader';
import { bulkUpdateHostel, listHostels, listStudents } from '../api/students-api';
import { describeStudentStatus } from '../components/student-status';

type Filters = Omit<AdminStudentListQuery, 'page' | 'pageSize' | 'sortBy' | 'sortOrder'>;
const meta = (value: (row: AdminStudentListItem) => string | number): DataTableColumnMeta => ({
  exportValue: (row) => value(row as AdminStudentListItem),
});

/** Admin §G student list: search, filters and bulk hostel update. */
export function StudentsPage() {
  const queryClient = useQueryClient();
  const table = useTableState();
  const [filters, setFilters] = useState<Filters>({});
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [isMoving, setIsMoving] = useState(false);
  const [targetBlockId, setTargetBlockId] = useState('');

  const query = { ...table.state, ...filters };
  const students = useQuery({ queryKey: ['students', query], queryFn: () => listStudents(query) });
  const hostels = useQuery({ queryKey: ['hostels'], queryFn: listHostels });
  const blocks = (hostels.data ?? []).flatMap((hostel) =>
    hostel.blocks.map((block) => ({ ...block, label: `${hostel.name} • ${block.name}` })),
  );
  const selectedIds = Object.keys(selection).filter((id) => selection[id]);

  const move = useMutation({
    mutationFn: (reason: string) => bulkUpdateHostel(selectedIds, targetBlockId, reason),
    onSuccess: ({ updated }) => {
      toast.success(`${updated} students moved.`);
      setIsMoving(false);
      setSelection({});
      void queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K] | '') => {
    setFilters((current) => ({ ...current, [key]: value === '' ? undefined : value }));
    table.resetPage();
  };

  const columns = useMemo<ColumnDef<AdminStudentListItem, unknown>[]>(
    () => [
      {
        id: 'select',
        enableHiding: false,
        header: ({ table: grid }) => (
          <Checkbox
            aria-label="Select all on this page"
            checked={grid.getIsAllPageRowsSelected()}
            onChange={(event) => grid.toggleAllPageRowsSelected(event.target.checked)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select ${row.original.fullName}`}
            checked={row.getIsSelected()}
            onChange={(event) => row.toggleSelected(event.target.checked)}
          />
        ),
      },
      {
        id: 'fullName',
        header: 'Student',
        enableHiding: false,
        cell: ({ row }) => (
          <Link
            to={`/students/${row.original.rosterEntryId}`}
            className="font-medium text-primary hover:underline"
          >
            {row.original.fullName}
            <span className="block text-xs font-normal text-muted-foreground">
              {row.original.referenceNumber}
            </span>
          </Link>
        ),
        meta: meta((row) => row.fullName),
      },
      {
        id: 'referenceNumber',
        header: 'Reference number',
        accessorKey: 'referenceNumber',
        meta: meta((row) => row.referenceNumber),
      },
      {
        id: 'department',
        header: 'Department',
        accessorKey: 'department',
        meta: meta((row) => row.department),
      },
      {
        id: 'academicYear',
        header: 'Year',
        accessorKey: 'academicYear',
        meta: meta((row) => row.academicYear),
      },
      {
        id: 'hostel',
        header: 'Hostel',
        cell: ({ row }) =>
          row.original.blockName ? `${row.original.hostelName} • ${row.original.blockName}` : '—',
        meta: meta((row) => (row.blockName ? `${row.hostelName} ${row.blockName}` : '')),
      },
      {
        id: 'roomNumber',
        header: 'Room',
        cell: ({ row }) => row.original.roomNumber ?? '—',
        meta: meta((row) => row.roomNumber ?? ''),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const status = describeStudentStatus(row.original);
          return <StatusBadge label={status.label} tone={status.tone} />;
        },
        meta: meta((row) => describeStudentStatus(row).label),
      },
      {
        id: 'defaultBooking',
        header: 'Default Booking',
        cell: ({ row }) =>
          row.original.defaultBookingEnabled === null
            ? '—'
            : row.original.defaultBookingEnabled
              ? 'ON'
              : 'OFF',
        meta: meta((row) =>
          row.defaultBookingEnabled === null ? '' : row.defaultBookingEnabled ? 'ON' : 'OFF',
        ),
      },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        title="Students"
        breadcrumbs={[{ label: 'Students' }]}
        actions={
          <>
            <PermissionGate permissions={['students:update']}>
              <Button
                variant="outline"
                disabled={selectedIds.length === 0}
                onClick={() => setIsMoving(true)}
              >
                Move {selectedIds.length || ''} to hostel…
              </Button>
            </PermissionGate>
            <PermissionGate permissions={['roster:import']}>
              <Button asChild>
                <Link to="/students/import">Import roster</Link>
              </Button>
            </PermissionGate>
          </>
        }
      />
      <DataTable
        caption="Students"
        columns={columns}
        rows={students.data?.items ?? []}
        total={students.data?.total ?? 0}
        state={table.state}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        getRowId={(row) => row.rosterEntryId}
        rowSelection={selection}
        onRowSelectionChange={setSelection}
        isLoading={students.isLoading}
        error={students.error}
        onRetry={() => void students.refetch()}
        emptyTitle="No students match these filters"
        exportFileName="students.csv"
        toolbar={
          <>
            <Input
              aria-label="Search students"
              placeholder="Name or reference number"
              className="w-60"
              onChange={(event) => setFilter('q', event.target.value)}
            />
            <Select
              aria-label="Hostel block"
              className="w-48"
              onChange={(event) => setFilter('hostelBlockId', event.target.value)}
            >
              <option value="">All hostels</option>
              {blocks.map((block) => (
                <option key={block.id} value={block.id}>
                  {block.label}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Year"
              className="w-28"
              onChange={(event) =>
                setFilter('academicYear', event.target.value ? Number(event.target.value) : '')
              }
            >
              <option value="">All years</option>
              {[1, 2, 3, 4, 5].map((year) => (
                <option key={year} value={year}>
                  Year {year}
                </option>
              ))}
            </Select>
            <Input
              aria-label="Department"
              placeholder="Department"
              className="w-40"
              onChange={(event) => setFilter('department', event.target.value)}
            />
            <Select
              aria-label="Registration"
              className="w-40"
              onChange={(event) =>
                setFilter('registration', event.target.value as Filters['registration'] | '')
              }
            >
              <option value="">Registered or not</option>
              <option value="REGISTERED">Registered</option>
              <option value="UNREGISTERED">Not registered</option>
            </Select>
            <Select
              aria-label="Account status"
              className="w-36"
              onChange={(event) =>
                setFilter('status', event.target.value as Filters['status'] | '')
              }
            >
              <option value="">Any status</option>
              <option value="ACTIVE">Active</option>
              <option value="LOCKED">Locked</option>
              <option value="DEACTIVATED">Deactivated</option>
            </Select>
            <Select
              aria-label="Default Booking"
              className="w-44"
              onChange={(event) =>
                setFilter('defaultBooking', event.target.value as Filters['defaultBooking'] | '')
              }
            >
              <option value="">Default Booking: any</option>
              <option value="ON">Default Booking ON</option>
              <option value="OFF">Default Booking OFF</option>
            </Select>
          </>
        }
      />
      <ReasonDialog
        open={isMoving}
        onOpenChange={setIsMoving}
        title={`Move ${selectedIds.length} students`}
        description="Updates the roster and each registered student's own hostel details."
        confirmLabel="Move students"
        isPending={move.isPending}
        error={move.error}
        onConfirm={(reason) =>
          targetBlockId ? move.mutate(reason) : toast.error('Choose a hostel block.')
        }
      >
        <Field label="New hostel block" htmlFor="target-block">
          <Select
            id="target-block"
            value={targetBlockId}
            onChange={(event) => setTargetBlockId(event.target.value)}
          >
            <option value="">Choose…</option>
            {blocks
              .filter((block) => block.isActive)
              .map((block) => (
                <option key={block.id} value={block.id}>
                  {block.label}
                </option>
              ))}
          </Select>
        </Field>
      </ReasonDialog>
    </div>
  );
}
