import {
  type AdminBooking,
  type AdminBookingListQuery,
  type BulkBookingAction,
  type MealType,
} from '@ennel/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef, type RowSelectionState } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { DataTable, type DataTableColumnMeta } from '@/shared/components/DataTable';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Checkbox, Input, Select } from '@/shared/components/ui/form-controls';
import { useTableState } from '@/shared/hooks/use-table-state';
import { PageHeader } from '@/shared/layout/PageHeader';
import { formatDateTime, todayBusinessDate } from '@/shared/lib/format';
import { listHostels, listMeals } from '@/features/mess-config/api/mess-config-api';
import { usePermissions } from '@/features/auth/auth-context';
import { listBookings } from '../api/bookings-api';
import { BulkBookingDialog } from '../components/BulkBookingDialog';
import { CreateBookingDialog } from '../components/CreateBookingDialog';
import { type RowAction, RowActionDialog } from '../components/RowActionDialog';
import {
  BOOKING_SOURCE_LABELS,
  BOOKING_STATUS_DISPLAY,
  DIET_LABELS,
  MEAL_LABELS,
} from '../constants/booking-display';

type Filters = Omit<AdminBookingListQuery, 'page' | 'pageSize' | 'sortBy' | 'sortOrder'>;
const meta = (value: (row: AdminBooking) => string): DataTableColumnMeta => ({
  exportValue: (row) => value(row as AdminBooking),
});

/** Admin §H bookings: one date, filtered, with staff overrides and bulk actions. */
export function BookingsPage() {
  const queryClient = useQueryClient();
  const can = usePermissions();
  const table = useTableState();
  const [filters, setFilters] = useState<Filters>({ date: todayBusinessDate() });
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [rowAction, setRowAction] = useState<RowAction | null>(null);
  const [bulkAction, setBulkAction] = useState<BulkBookingAction | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const query = { ...table.state, ...filters };
  const bookings = useQuery({ queryKey: ['bookings', query], queryFn: () => listBookings(query) });
  const meals = useQuery({ queryKey: ['mess-config', 'meals'], queryFn: listMeals });
  const hostels = useQuery({ queryKey: ['hostels'], queryFn: listHostels });
  const rows = bookings.data?.items ?? [];
  const selected = rows.filter((row) => selection[row.id]);
  const selectedMeal =
    new Set(selected.map((row) => row.mealType)).size === 1
      ? (selected[0]?.mealType ?? null)
      : null;
  const slotOptions = (meals.data ?? [])
    .filter((meal) => !filters.mealType || meal.mealType === filters.mealType)
    .flatMap((meal) =>
      meal.slots.map((slot) => ({
        id: slot.id,
        label: `${MEAL_LABELS[meal.mealType]} ${slot.label}`,
      })),
    );

  const refresh = () => {
    setRowAction(null);
    setBulkAction(null);
    setIsCreating(false);
    setSelection({});
    void queryClient.invalidateQueries({ queryKey: ['bookings'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K] | '') => {
    setFilters((current) => ({ ...current, [key]: value === '' ? undefined : value }));
    table.resetPage();
    setSelection({});
  };

  const columns = useMemo(() => buildColumns(can('bookings:override'), setRowAction), [can]);

  return (
    <div>
      <PageHeader
        title="Bookings"
        description="Staff changes skip student deadlines, need a reason, and show the student “Updated by mess staff”."
        breadcrumbs={[{ label: 'Bookings' }]}
        actions={
          <>
            <PermissionGate permissions={['bookings:bulk']}>
              <Button
                variant="outline"
                disabled={selected.length === 0}
                onClick={() => setBulkAction('MOVE')}
              >
                Move {selected.length || ''} selected…
              </Button>
              <Button
                variant="outline"
                disabled={selected.length === 0}
                onClick={() => setBulkAction('CANCEL')}
              >
                Cancel {selected.length || ''} selected…
              </Button>
            </PermissionGate>
            <PermissionGate permissions={['bookings:override', 'students:read']}>
              <Button onClick={() => setIsCreating(true)}>Book for a student</Button>
            </PermissionGate>
          </>
        }
      />
      <DataTable
        caption="Bookings"
        columns={columns}
        rows={rows}
        total={bookings.data?.total ?? 0}
        state={table.state}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        onSortChange={table.setSort}
        getRowId={(row) => row.id}
        rowSelection={selection}
        onRowSelectionChange={can('bookings:bulk') ? setSelection : undefined}
        isLoading={bookings.isLoading}
        error={bookings.error}
        onRetry={() => void bookings.refetch()}
        emptyTitle="No bookings match these filters"
        exportFileName={`bookings-${filters.date}.csv`}
        toolbar={
          <>
            <Input
              type="date"
              aria-label="Date"
              className="w-40"
              value={filters.date}
              onChange={(event) => event.target.value && setFilter('date', event.target.value)}
            />
            <Input
              aria-label="Search bookings"
              placeholder="Name or reference number"
              className="w-56"
              onChange={(event) => setFilter('q', event.target.value)}
            />
            <Select
              aria-label="Meal"
              className="w-32"
              onChange={(event) => (
                setFilter('mealType', event.target.value as MealType | ''),
                setFilter('slotId', '')
              )}
            >
              <option value="">All meals</option>
              {(['BREAKFAST', 'LUNCH', 'DINNER'] as const).map((meal) => (
                <option key={meal} value={meal}>
                  {MEAL_LABELS[meal]}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Slot"
              className="w-52"
              value={filters.slotId ?? ''}
              onChange={(event) => setFilter('slotId', event.target.value)}
            >
              <option value="">All slots</option>
              {slotOptions.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.label}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Status"
              className="w-40"
              onChange={(event) =>
                setFilter('status', event.target.value as Filters['status'] | '')
              }
            >
              <option value="">Any status</option>
              {Object.entries(BOOKING_STATUS_DISPLAY).map(([value, display]) => (
                <option key={value} value={value}>
                  {display.label}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Source"
              className="w-44"
              onChange={(event) =>
                setFilter('source', event.target.value as Filters['source'] | '')
              }
            >
              <option value="">Any source</option>
              {Object.entries(BOOKING_SOURCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Hostel"
              className="w-40"
              onChange={(event) => setFilter('hostelId', event.target.value)}
            >
              <option value="">All hostels</option>
              {(hostels.data ?? []).map((hostel) => (
                <option key={hostel.id} value={hostel.id}>
                  {hostel.name}
                </option>
              ))}
            </Select>
          </>
        }
      />
      <RowActionDialog
        action={rowAction}
        meals={meals.data ?? []}
        onClose={() => setRowAction(null)}
        onDone={refresh}
      />
      <BulkBookingDialog
        action={bulkAction}
        bookingIds={selected.map((row) => row.id)}
        meals={meals.data ?? []}
        mealType={selectedMeal}
        onClose={() => setBulkAction(null)}
        onDone={refresh}
      />
      <CreateBookingDialog
        open={isCreating}
        date={filters.date}
        meals={meals.data ?? []}
        onOpenChange={setIsCreating}
        onDone={refresh}
      />
    </div>
  );
}

function buildColumns(
  canOverride: boolean,
  onAction: (action: RowAction) => void,
): ColumnDef<AdminBooking, unknown>[] {
  const columns: ColumnDef<AdminBooking, unknown>[] = [
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
          aria-label={`Select ${row.original.studentName}`}
          checked={row.getIsSelected()}
          onChange={(event) => row.toggleSelected(event.target.checked)}
        />
      ),
    },
    {
      id: 'student',
      header: 'Student',
      enableSorting: true,
      enableHiding: false,
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.studentName}
          <span className="block text-xs font-normal text-muted-foreground">
            {row.original.referenceNumber}
          </span>
        </span>
      ),
      meta: meta((row) => `${row.studentName} (${row.referenceNumber})`),
    },
    {
      id: 'hostel',
      header: 'Hostel',
      cell: ({ row }) =>
        row.original.blockName ? `${row.original.hostelName} • ${row.original.blockName}` : '—',
      meta: meta((row) => (row.blockName ? `${row.hostelName} ${row.blockName}` : '')),
    },
    {
      id: 'meal',
      header: 'Meal',
      cell: ({ row }) => MEAL_LABELS[row.original.mealType],
      meta: meta((row) => MEAL_LABELS[row.mealType]),
    },
    {
      id: 'slot',
      header: 'Slot',
      enableSorting: true,
      cell: ({ row }) => row.original.slotLabel,
      meta: meta((row) => row.slotLabel),
    },
    {
      id: 'diet',
      header: 'Meal type',
      cell: ({ row }) => DIET_LABELS[row.original.dietType],
      meta: meta((row) => DIET_LABELS[row.dietType]),
    },
    {
      id: 'status',
      header: 'Status',
      enableSorting: true,
      cell: ({ row }) => (
        <span className="flex flex-wrap gap-1">
          <StatusBadge {...BOOKING_STATUS_DISPLAY[row.original.status]} />
          {row.original.isUpdatedByStaff ? (
            <StatusBadge label="Updated by staff" tone="info" />
          ) : null}
          {row.original.isOverCapacity ? (
            <StatusBadge label="Over capacity" tone="warning" />
          ) : null}
        </span>
      ),
      meta: meta((row) => BOOKING_STATUS_DISPLAY[row.status].label),
    },
    {
      id: 'source',
      header: 'Source',
      cell: ({ row }) => BOOKING_SOURCE_LABELS[row.original.source],
      meta: meta((row) => BOOKING_SOURCE_LABELS[row.source]),
    },
    {
      id: 'updatedAt',
      header: 'Last change',
      enableSorting: true,
      cell: ({ row }) => formatDateTime(row.original.updatedAt),
      meta: meta((row) => formatDateTime(row.updatedAt)),
    },
  ];
  if (!canOverride) return columns;
  return [
    ...columns,
    {
      id: 'actions',
      header: 'Actions',
      enableHiding: false,
      cell: ({ row }) => <RowMenu booking={row.original} onAction={onAction} />,
    },
  ];
}

function RowMenu({
  booking,
  onAction,
}: {
  booking: AdminBooking;
  onAction: (action: RowAction) => void;
}) {
  const isBooked = booking.status === 'BOOKED';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Actions for ${booking.studentName}`}>
          Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {isBooked ? (
          <DropdownMenuItem onSelect={() => onAction({ kind: 'move', booking })}>
            Move to another slot
          </DropdownMenuItem>
        ) : null}
        {isBooked ? (
          <DropdownMenuItem onSelect={() => onAction({ kind: 'cancel', booking })}>
            Cancel booking
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={() => onAction({ kind: 'status', booking })}>
          Correct status
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
