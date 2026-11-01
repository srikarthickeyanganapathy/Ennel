import {
  type AdminComplaint,
  type ComplaintCategory,
  type ComplaintStatus,
  type ComplaintType,
  MEAL_TYPE_ORDER,
  type MealType,
} from '@ennel/shared';
import { useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { DataTable, type DataTableColumnMeta } from '@/shared/components/DataTable';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { Checkbox, Input, Label, Select } from '@/shared/components/ui/form-controls';
import { useTableState } from '@/shared/hooks/use-table-state';
import { PageHeader } from '@/shared/layout/PageHeader';
import { formatBusinessDate, formatDateTime } from '@/shared/lib/format';
import { listHostels } from '@/features/students/api/students-api';
import { listComplaints } from '../api/complaints-api';
import { ComplaintAnalyticsCard } from '../components/ComplaintAnalyticsCard';
import { ComplaintDetailDialog } from '../components/ComplaintDetailDialog';
import { CATEGORY_NAMES, MEAL_NAMES, STATUS, TYPE_NAMES } from '../components/complaint-labels';

const meta = (value: (row: AdminComplaint) => string): DataTableColumnMeta => ({
  exportValue: (row) => value(row as AdminComplaint),
});
const submitterText = (row: AdminComplaint) =>
  row.submitter
    ? `${row.submitter.fullName} (${row.submitter.referenceNumber})`
    : row.privacyMode === 'ANONYMOUS'
      ? 'Anonymous'
      : 'Hidden';
const mealText = (row: AdminComplaint) =>
  row.mealType && row.mealDate
    ? `${MEAL_NAMES[row.mealType]}, ${formatBusinessDate(row.mealDate, 'EEE d MMM')}`
    : '—';

const EMPTY_FILTERS = {
  status: '',
  type: '',
  category: '',
  mealType: '',
  hostelBlockId: '',
  from: '',
  to: '',
  assignedToMe: false,
};

/** Admin §L: complaints and feedback inbox with filters, detail and analytics. */
export function ComplaintsPage() {
  const table = useTableState(20);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [openId, setOpenId] = useState<string | null>(null);
  const query = {
    ...table.state,
    status: (filters.status || undefined) as ComplaintStatus | undefined,
    type: (filters.type || undefined) as ComplaintType | undefined,
    category: (filters.category || undefined) as ComplaintCategory | undefined,
    mealType: (filters.mealType || undefined) as MealType | undefined,
    hostelBlockId: filters.hostelBlockId || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    assignedToMe: filters.assignedToMe ? ('true' as const) : undefined,
  };
  const list = useQuery({
    queryKey: ['admin-complaints', 'list', query],
    queryFn: () => listComplaints(query),
  });
  const hostels = useQuery({ queryKey: ['hostels'], queryFn: listHostels });
  const blocks = (hostels.data ?? []).flatMap((hostel) =>
    hostel.blocks.map((block) => ({ id: block.id, label: `${hostel.name} • ${block.name}` })),
  );
  const update = (key: keyof typeof filters, value: string | boolean) => {
    setFilters((current) => ({ ...current, [key]: value }));
    table.resetPage();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Complaints & feedback"
        breadcrumbs={[{ label: 'Complaints' }]}
        description="Reports from students. Internal notes are never shown to students; replies are."
      />
      <ComplaintAnalyticsCard />
      <DataTable
        caption="Complaints"
        columns={columns(setOpenId)}
        rows={list.data?.items ?? []}
        total={list.data?.total ?? 0}
        state={table.state}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        getRowId={(row) => row.id}
        isLoading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        emptyTitle="No complaints match these filters"
        exportFileName="complaints-page.csv"
        toolbar={
          <>
            <FilterSelect
              label="Status"
              value={filters.status}
              onChange={(value) => update('status', value)}
              options={Object.entries(STATUS).map(([value, item]) => [value, item.label])}
              allLabel="All statuses"
            />
            <FilterSelect
              label="Type"
              value={filters.type}
              onChange={(value) => update('type', value)}
              options={Object.entries(TYPE_NAMES)}
              allLabel="All types"
            />
            <FilterSelect
              label="Category"
              value={filters.category}
              onChange={(value) => update('category', value)}
              options={Object.entries(CATEGORY_NAMES)}
              allLabel="All categories"
            />
            <FilterSelect
              label="Meal"
              value={filters.mealType}
              onChange={(value) => update('mealType', value)}
              options={MEAL_TYPE_ORDER.map((meal) => [meal, MEAL_NAMES[meal]])}
              allLabel="All meals"
            />
            <FilterSelect
              label="Hostel block"
              value={filters.hostelBlockId}
              onChange={(value) => update('hostelBlockId', value)}
              options={blocks.map((block) => [block.id, block.label])}
              allLabel="All blocks"
            />
            <Input
              aria-label="From"
              type="date"
              className="w-40"
              value={filters.from}
              onChange={(event) => update('from', event.target.value)}
            />
            <Input
              aria-label="To"
              type="date"
              className="w-40"
              value={filters.to}
              onChange={(event) => update('to', event.target.value)}
            />
            <Label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={filters.assignedToMe}
                onChange={(event) => update('assignedToMe', event.target.checked)}
              />
              Assigned to me
            </Label>
          </>
        }
      />
      {openId ? <ComplaintDetailDialog id={openId} onClose={() => setOpenId(null)} /> : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  allLabel: string;
}) {
  return (
    <Select
      aria-label={label}
      className="w-40"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{allLabel}</option>
      {options.map(([optionValue, optionLabel]) => (
        <option key={optionValue} value={optionValue}>
          {optionLabel}
        </option>
      ))}
    </Select>
  );
}

function columns(onOpen: (id: string) => void): ColumnDef<AdminComplaint>[] {
  return [
    {
      id: 'reference',
      header: 'Reference',
      cell: ({ row }) => <span className="font-medium">{row.original.referenceCode}</span>,
      meta: meta((row) => row.referenceCode),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge {...STATUS[row.original.status]} />,
      meta: meta((row) => STATUS[row.status].label),
    },
    {
      id: 'kind',
      header: 'Type / category',
      cell: ({ row }) =>
        `${TYPE_NAMES[row.original.type]} · ${CATEGORY_NAMES[row.original.category]}`,
      meta: meta((row) => `${TYPE_NAMES[row.type]} · ${CATEGORY_NAMES[row.category]}`),
    },
    { id: 'meal', header: 'Meal', cell: ({ row }) => mealText(row.original), meta: meta(mealText) },
    {
      id: 'submitter',
      header: 'From',
      cell: ({ row }) => submitterText(row.original),
      meta: meta(submitterText),
    },
    {
      id: 'assigned',
      header: 'Assigned to',
      cell: ({ row }) => row.original.assignedTo?.fullName ?? '—',
      meta: meta((row) => row.assignedTo?.fullName ?? ''),
    },
    {
      id: 'sent',
      header: 'Sent',
      cell: ({ row }) => formatDateTime(row.original.createdAt),
      meta: meta((row) => formatDateTime(row.createdAt)),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onOpen(row.original.id)}
          aria-label={`Open ${row.original.referenceCode}`}
        >
          Open
        </Button>
      ),
    },
  ];
}
