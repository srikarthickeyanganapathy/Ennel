import {
  type AdminComplaint,
  type AdminComplaintListQuery,
  type ComplaintCategory,
  type ComplaintStatus,
  type ComplaintType,
  MEAL_TYPE_ORDER,
  type MealType,
} from '@ennel/shared';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Check, Download } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { EmptyState, QueryBoundary } from '@/shared/components/QueryStates';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Dialog, DialogContent } from '@/shared/components/ui/dialog';
import { Checkbox, Input, Label, Select } from '@/shared/components/ui/form-controls';
import { PageHeader } from '@/shared/layout/PageHeader';
import { saveCsv, toCsv } from '@/shared/lib/csv';
import { addDays, formatDateTime, todayBusinessDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { listHostels } from '@/features/students/api/students-api';
import { getComplaintAnalytics, listComplaints } from '../api/complaints-api';
import { ComplaintAnalyticsCard } from '../components/ComplaintAnalyticsCard';
import { ComplaintDetailPanel, complaintTitle } from '../components/ComplaintDetailPanel';
import { ComplaintKpis } from '../components/ComplaintKpis';
import { ComplaintList } from '../components/ComplaintList';
import { CATEGORY_NAMES, MEAL_NAMES, STATUS, TYPE_NAMES } from '../components/complaint-labels';

const PAGE_SIZE = 20;
const STATUSES: ComplaintStatus[] = ['NEW', 'IN_REVIEW', 'RESOLVED', 'REJECTED'];
const EMPTY_FILTERS = {
  type: '',
  category: '',
  mealType: '',
  hostelBlockId: '',
  from: '',
  to: '',
  assignedToMe: false,
};
type Filters = typeof EMPTY_FILTERS;

const toQuery = (
  filters: Filters,
): Omit<AdminComplaintListQuery, 'page' | 'pageSize' | 'status'> => ({
  type: (filters.type || undefined) as ComplaintType | undefined,
  category: (filters.category || undefined) as ComplaintCategory | undefined,
  mealType: (filters.mealType || undefined) as MealType | undefined,
  hostelBlockId: filters.hostelBlockId || undefined,
  from: filters.from || undefined,
  to: filters.to || undefined,
  assignedToMe: filters.assignedToMe ? 'true' : undefined,
});

/**
 * Admin §L inbox, built from the Figma "Admin — Complaints" frame: KPI row, status chips, report
 * list and a detail pane. Below `lg` the detail opens in a dialog instead of beside the list.
 */
export function ComplaintsPage() {
  const isWide = useIsWide();
  const [status, setStatus] = useState<ComplaintStatus | 'ALL'>('NEW');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const base = toQuery(filters);
  const query = {
    ...base,
    status: status === 'ALL' ? undefined : status,
    page,
    pageSize: PAGE_SIZE,
  };
  const list = useQuery({
    queryKey: ['admin-complaints', 'list', query],
    queryFn: () => listComplaints(query),
  });
  const counts = useStatusCounts(base);
  const openCounts = useStatusCounts({});
  const analytics = useQuery({
    queryKey: ['admin-complaints', 'analytics', 'kpis'],
    queryFn: () => getComplaintAnalytics(addDays(todayBusinessDate(), -29), todayBusinessDate()),
  });
  const items = list.data?.items ?? [];
  // On wide screens the first report is shown straight away, as in the design.
  const selectedId = chosenId ?? (isWide ? (items[0]?.id ?? null) : null);
  const open = sumOf(openCounts, ['NEW', 'IN_REVIEW']);
  const update = (key: keyof Filters, value: string | boolean) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
    setChosenId(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Complaints & feedback"
        breadcrumbs={[{ label: 'Complaints' }]}
        description={`${open === null ? '…' : open} open · private to authorised staff`}
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={items.length === 0}
            onClick={() => exportPage(items)}
          >
            <Download aria-hidden /> Export CSV
          </Button>
        }
      />
      <ComplaintKpis open={open} analytics={analytics.data} />
      <details className="rounded-lg border border-border bg-background px-5 py-3">
        <summary className="cursor-pointer text-sm font-medium">Full quality breakdown</summary>
        <div className="mt-3">
          <ComplaintAnalyticsCard />
        </div>
      </details>

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <div role="radiogroup" aria-label="Status" className="flex flex-wrap gap-1.5">
            {(['ALL', ...STATUSES] as const).map((option) => {
              const isSelected = option === status;
              const count = option === 'ALL' ? sumOf(counts, STATUSES) : (counts[option] ?? null);
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => {
                    setStatus(option);
                    setPage(1);
                    setChosenId(null);
                  }}
                  className={cn(
                    'flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] pl-3 pr-3.5 text-sm',
                    isSelected
                      ? 'border-primary bg-mint font-semibold text-primary'
                      : 'border-border bg-background text-foreground hover:border-primary',
                  )}
                >
                  {isSelected ? <Check aria-hidden className="size-4" /> : null}
                  {option === 'ALL' ? 'All' : STATUS[option].label}
                  {count !== null ? ` · ${count}` : ''}
                </button>
              );
            })}
          </div>
          <SecondaryFilters filters={filters} onChange={update} />
          <QueryBoundary
            isLoading={list.isLoading}
            error={list.error}
            onRetry={() => void list.refetch()}
          >
            {items.length === 0 ? (
              <EmptyState title="No complaints match these filters" />
            ) : (
              <ComplaintList
                items={items}
                selectedId={selectedId}
                onSelect={setChosenId}
                page={page}
                pageCount={Math.max(1, Math.ceil((list.data?.total ?? 0) / PAGE_SIZE))}
                onPageChange={setPage}
              />
            )}
          </QueryBoundary>
        </div>
        {isWide ? (
          <Card className="self-start lg:sticky lg:top-6">
            {selectedId ? (
              <ComplaintDetailPanel id={selectedId} />
            ) : (
              <p className="text-sm text-muted-foreground">Choose a report to see it here.</p>
            )}
          </Card>
        ) : null}
      </div>

      {!isWide && selectedId ? (
        <Dialog open onOpenChange={(isOpen) => (isOpen ? undefined : setChosenId(null))}>
          <DialogContent title={titleFor(items, selectedId)} className="max-w-2xl">
            <ComplaintDetailPanel id={selectedId} isInDialog />
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function SecondaryFilters({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (key: keyof Filters, value: string | boolean) => void;
}) {
  const hostels = useQuery({ queryKey: ['hostels'], queryFn: listHostels });
  const blocks = (hostels.data ?? []).flatMap((hostel) =>
    hostel.blocks.map((block) => ({ id: block.id, label: `${hostel.name} • ${block.name}` })),
  );
  return (
    <div className="grid grid-cols-2 gap-2">
      <FilterSelect
        label="Type"
        value={filters.type}
        allLabel="All types"
        options={Object.entries(TYPE_NAMES)}
        onChange={(v) => onChange('type', v)}
      />
      <FilterSelect
        label="Category"
        value={filters.category}
        allLabel="All categories"
        options={Object.entries(CATEGORY_NAMES)}
        onChange={(v) => onChange('category', v)}
      />
      <FilterSelect
        label="Meal"
        value={filters.mealType}
        allLabel="All meals"
        options={MEAL_TYPE_ORDER.map((meal) => [meal, MEAL_NAMES[meal]])}
        onChange={(v) => onChange('mealType', v)}
      />
      <FilterSelect
        label="Hostel block"
        value={filters.hostelBlockId}
        allLabel="All blocks"
        options={blocks.map((block) => [block.id, block.label])}
        onChange={(v) => onChange('hostelBlockId', v)}
      />
      <Input
        aria-label="From"
        type="date"
        value={filters.from}
        onChange={(event) => onChange('from', event.target.value)}
      />
      <Input
        aria-label="To"
        type="date"
        value={filters.to}
        onChange={(event) => onChange('to', event.target.value)}
      />
      <Label className="col-span-2 flex items-center gap-2 text-sm">
        <Checkbox
          checked={filters.assignedToMe}
          onChange={(event) => onChange('assignedToMe', event.target.checked)}
        />
        Assigned to me
      </Label>
    </div>
  );
}

function FilterSelect(props: {
  label: string;
  value: string;
  allLabel: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <Select
      aria-label={props.label}
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
    >
      <option value="">{props.allLabel}</option>
      {props.options.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </Select>
  );
}

/** One small request per status (page size 1) gives the chip counts for the current filters. */
function useStatusCounts(
  base: ReturnType<typeof toQuery>,
): Partial<Record<ComplaintStatus, number>> {
  const results = useQueries({
    queries: STATUSES.map((status) => {
      const query = { ...base, status, page: 1, pageSize: 1 };
      return {
        queryKey: ['admin-complaints', 'list', query],
        queryFn: () => listComplaints(query),
      };
    }),
  });
  return Object.fromEntries(
    STATUSES.flatMap((status, index) => {
      const total = results[index]?.data?.total;
      return total === undefined ? [] : [[status, total]];
    }),
  );
}

function sumOf(
  counts: Partial<Record<ComplaintStatus, number>>,
  statuses: ComplaintStatus[],
): number | null {
  if (statuses.some((status) => counts[status] === undefined)) return null;
  return statuses.reduce((sum, status) => sum + (counts[status] ?? 0), 0);
}

const WIDE_QUERY = '(min-width: 1024px)';
/** Matches Tailwind's `lg`; jsdom has no matchMedia, so tests get the wide layout. */
function useIsWide(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => undefined;
      const media = window.matchMedia(WIDE_QUERY);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(WIDE_QUERY).matches : true),
  );
}

function titleFor(items: AdminComplaint[], id: string): string {
  const item = items.find((row) => row.id === id);
  return item ? complaintTitle(item) : 'Complaint';
}

/** Admin UX standards: CSV export of the reports on screen. */
function exportPage(items: AdminComplaint[]) {
  const rows = items.map((item) => [
    item.referenceCode,
    STATUS[item.status].label,
    TYPE_NAMES[item.type],
    CATEGORY_NAMES[item.category],
    item.mealType ? MEAL_NAMES[item.mealType] : '',
    item.mealDate ?? '',
    item.submitter ? `${item.submitter.fullName} (${item.submitter.referenceNumber})` : 'Hidden',
    item.assignedTo?.fullName ?? '',
    formatDateTime(item.createdAt),
  ]);
  saveCsv(
    'complaints-page.csv',
    toCsv(
      [
        'Reference',
        'Status',
        'Type',
        'Category',
        'Meal',
        'Meal date',
        'From',
        'Assigned to',
        'Sent',
      ],
      rows,
    ),
  );
}
