import {
  type AdminStudentList,
  type AdminStudentListItem,
  type AdminStudentListQuery,
} from '@ennel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, MoreHorizontal, Search } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { ChoiceChip } from '@/shared/components/ChoiceChip';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { EmptyState, QueryBoundary } from '@/shared/components/QueryStates';
import { ReasonDialog } from '@/shared/components/ReasonDialog';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Dialog, DialogContent } from '@/shared/components/ui/dialog';
import { Checkbox, Field, Input, Select } from '@/shared/components/ui/form-controls';
import { PageHeader } from '@/shared/layout/PageHeader';
import { saveCsv, toCsv } from '@/shared/lib/csv';
import { cn } from '@/shared/lib/utils';
import { bulkUpdateHostel, listHostels, listStudents } from '../api/students-api';
import { initials, MEAL_NAMES, MealDots, NoShowCounts } from '../components/student-cells';
import { StudentDetailsPanel } from '../components/StudentDetailsPanel';
import { describeStudentStatus } from '../components/student-status';

type Filters = Omit<AdminStudentListQuery, 'page' | 'pageSize' | 'sortBy' | 'sortOrder'>;
const PAGE_SIZE = 20;

/**
 * Admin §G student list, built from the Figma "Admin — Students" frame: search and filter chips,
 * a table with per-meal Default Booking and No-show columns, and a details panel.
 */
export function StudentsPage() {
  const queryClient = useQueryClient();
  const isWide = useIsWide();
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const query = { ...filters, page, pageSize: PAGE_SIZE };
  const students = useQuery({ queryKey: ['students', query], queryFn: () => listStudents(query) });
  const data = students.data;
  const items = data?.items ?? [];
  const detailsId = openId ?? (isWide ? (items[0]?.rosterEntryId ?? null) : null);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K] | '') => {
    setFilters((current) => ({ ...current, [key]: value === '' ? undefined : value }));
    setPage(1);
    // Selected rows the new filter hides would otherwise be moved without being seen.
    setSelected(new Set());
    setOpenId(null);
  };
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        breadcrumbs={[{ label: 'Students' }]}
        description={data ? `${data.total.toLocaleString('en-IN')} matching students` : undefined}
      />
      <FilterBar
        filters={filters}
        warningThreshold={data?.noShowWarningThreshold ?? null}
        onChange={setFilter}
        actions={
          <>
            <PermissionGate permissions={['students:update']}>
              <Button
                variant="outline"
                disabled={selected.size === 0}
                onClick={() => setIsMoving(true)}
              >
                Move {selected.size || ''} to hostel…
              </Button>
            </PermissionGate>
            <Button
              variant="ghost"
              className="text-primary"
              disabled={items.length === 0}
              onClick={() => exportPage(items)}
            >
              Export
            </Button>
            <PermissionGate permissions={['roster:import']}>
              <Button asChild className="min-h-11">
                <Link to="/students/import">Import CSV</Link>
              </Button>
            </PermissionGate>
          </>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <QueryBoundary
          isLoading={students.isLoading}
          error={students.error}
          onRetry={() => void students.refetch()}
        >
          {data && items.length > 0 ? (
            <StudentTable
              data={data}
              selected={selected}
              onToggle={toggle}
              onToggleAll={(isOn) =>
                setSelected(isOn ? new Set(items.map((item) => item.rosterEntryId)) : new Set())
              }
              openId={detailsId}
              onOpen={setOpenId}
              page={page}
              onPageChange={setPage}
            />
          ) : (
            <EmptyState title="No students match these filters" />
          )}
        </QueryBoundary>
        {isWide ? (
          <Card className="self-start xl:sticky xl:top-6">
            {detailsId ? (
              <StudentDetailsPanel id={detailsId} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Choose a student to see their details.
              </p>
            )}
          </Card>
        ) : null}
      </div>
      {!isWide && detailsId ? (
        <Dialog open onOpenChange={(isOpen) => (isOpen ? undefined : setOpenId(null))}>
          <DialogContent title="Student details">
            <StudentDetailsPanel id={detailsId} />
          </DialogContent>
        </Dialog>
      ) : null}
      {isMoving ? (
        <MoveDialog
          ids={[...selected]}
          onClose={() => setIsMoving(false)}
          onMoved={() => {
            setIsMoving(false);
            setSelected(new Set());
            void queryClient.invalidateQueries({ queryKey: ['students'] });
            void queryClient.invalidateQueries({ queryKey: ['student'] });
            void queryClient.invalidateQueries({ queryKey: ['hostels'] });
          }}
        />
      ) : null}
    </div>
  );
}

function FilterBar({
  filters,
  warningThreshold,
  onChange,
  actions,
}: {
  filters: Filters;
  warningThreshold: number | null;
  onChange: <K extends keyof Filters>(key: K, value: Filters[K] | '') => void;
  actions: React.ReactNode;
}) {
  const hostels = useQuery({ queryKey: ['hostels'], queryFn: listHostels });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-11 w-full items-center gap-2 rounded-md border border-border bg-background px-3 focus-within:outline-2 focus-within:outline-primary sm:w-[300px]">
          <Search aria-hidden className="size-4 text-muted-foreground" />
          <input
            aria-label="Search students"
            placeholder="Name or reference no."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            onChange={(event) => onChange('q', event.target.value)}
          />
        </label>
        <ChipSelect
          label="Hostel"
          value={filters.hostelId ?? ''}
          onChange={(value) => onChange('hostelId', value)}
        >
          {(hostels.data ?? []).map((hostel) => (
            <option key={hostel.id} value={hostel.id}>
              {hostel.name}
            </option>
          ))}
        </ChipSelect>
        <ChipSelect
          label="Year"
          value={filters.academicYear ? String(filters.academicYear) : ''}
          onChange={(value) => onChange('academicYear', value ? Number(value) : '')}
        >
          {[1, 2, 3, 4, 5].map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </ChipSelect>
        <div role="group" aria-label="Quick filters" className="contents">
          <ChoiceChip
            role="checkbox"
            label={`No-shows ≥ ${warningThreshold ?? '…'}`}
            isSelected={filters.atNoShowWarning === 'true'}
            onClick={() =>
              onChange('atNoShowWarning', filters.atNoShowWarning === 'true' ? '' : 'true')
            }
          />
          <ChoiceChip
            role="checkbox"
            label="On leave"
            isSelected={filters.onLeave === 'true'}
            onClick={() => onChange('onLeave', filters.onLeave === 'true' ? '' : 'true')}
          />
        </div>
        <div className="flex flex-wrap gap-2 lg:ml-auto">{actions}</div>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-muted-foreground">More filters</summary>
        <div className="mt-2 flex flex-wrap gap-2">
          <Input
            aria-label="Department"
            placeholder="Department"
            className="w-40"
            onChange={(event) => onChange('department', event.target.value)}
          />
          <Select
            aria-label="Registration"
            className="w-44"
            onChange={(event) =>
              onChange('registration', event.target.value as Filters['registration'] | '')
            }
          >
            <option value="">Registered or not</option>
            <option value="REGISTERED">Registered</option>
            <option value="UNREGISTERED">Not registered</option>
          </Select>
          <Select
            aria-label="Account status"
            className="w-40"
            onChange={(event) => onChange('status', event.target.value as Filters['status'] | '')}
          >
            <option value="">Any status</option>
            <option value="ACTIVE">Active</option>
            <option value="LOCKED">Locked</option>
            <option value="DEACTIVATED">Deactivated</option>
          </Select>
          <Select
            aria-label="Default Booking"
            className="w-48"
            onChange={(event) =>
              onChange('defaultBooking', event.target.value as Filters['defaultBooking'] | '')
            }
          >
            <option value="">Default Booking: any</option>
            <option value="ON">Default Booking ON</option>
            <option value="OFF">Default Booking OFF</option>
          </Select>
        </div>
      </details>
    </div>
  );
}

/** A native select dressed as the Figma "Hostel: All" chip. */
function ChipSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        'min-h-11 cursor-pointer rounded-full border-[1.5px] px-3.5 text-sm',
        value
          ? 'border-primary bg-mint font-semibold text-primary'
          : 'border-border bg-background text-foreground',
      )}
    >
      <option value="">{label}: All</option>
      {children}
    </select>
  );
}

function StudentTable(props: {
  data: AdminStudentList;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (isOn: boolean) => void;
  openId: string | null;
  onOpen: (id: string) => void;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const { data } = props;
  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));
  const allOnPage = data.items.every((item) => props.selected.has(item.rosterEntryId));
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-background">
      {/* Positioned, so screen-reader-only labels stay inside the scrolling area. */}
      <div className="relative overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Students</caption>
          <thead className="whitespace-nowrap bg-neutral-surface text-left text-xs font-semibold text-muted-foreground">
            <tr>
              <th className="w-10 py-3 pl-3 pr-2">
                <Checkbox
                  aria-label="Select all on this page"
                  checked={allOnPage}
                  onChange={(event) => props.onToggleAll(event.target.checked)}
                />
              </th>
              <th className="px-2 py-3">Student</th>
              <th className="px-2 py-3">Hostel · Room</th>
              <th className="px-2 py-3">Dept · Year</th>
              <th className="px-2 py-3">Default (B L D)</th>
              <th className="px-2 py-3">No-shows (B L D)</th>
              <th className="px-2 py-3">Leave</th>
              <th className="w-10 px-1 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <StudentRow key={item.rosterEntryId} item={item} {...props} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 border-t border-border px-4 py-3 text-[13px] text-muted-foreground">
        <span>
          Showing {data.items.length} of {data.total.toLocaleString('en-IN')} matching
          {props.selected.size > 0 ? ` · ${props.selected.size} selected` : ''}
        </span>
        <span className="ml-auto flex items-center gap-1 text-foreground">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Previous page"
            disabled={props.page <= 1}
            onClick={() => props.onPageChange(props.page - 1)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <span className="font-medium">
            {props.page} / {pageCount}
          </span>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Next page"
            disabled={props.page >= pageCount}
            onClick={() => props.onPageChange(props.page + 1)}
          >
            <ChevronRight aria-hidden />
          </Button>
        </span>
      </div>
    </div>
  );
}

function StudentRow({
  item,
  data,
  selected,
  onToggle,
  openId,
  onOpen,
}: {
  item: AdminStudentListItem;
  data: AdminStudentList;
  selected: Set<string>;
  onToggle: (id: string) => void;
  openId: string | null;
  onOpen: (id: string) => void;
}) {
  const status = describeStudentStatus(item);
  const isOpen = item.rosterEntryId === openId;
  return (
    <tr
      className={cn(
        'cursor-pointer border-t border-border hover:bg-mint/40',
        (isOpen || selected.has(item.rosterEntryId)) && 'bg-mint',
      )}
      onClick={() => onOpen(item.rosterEntryId)}
    >
      <td className="py-3 pl-3 pr-2" onClick={(event) => event.stopPropagation()}>
        <Checkbox
          aria-label={`Select ${item.fullName}`}
          checked={selected.has(item.rosterEntryId)}
          onChange={() => onToggle(item.rosterEntryId)}
        />
      </td>
      <td className="px-2 py-3">
        <button
          type="button"
          aria-pressed={isOpen}
          aria-label={`Show details for ${item.fullName}`}
          className="flex items-center gap-2.5 text-left"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(item.rosterEntryId);
          }}
        >
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-surface text-[11px] font-bold text-muted-foreground"
          >
            {initials(item.fullName)}
          </span>
          <span>
            <span className="block whitespace-nowrap font-semibold">{item.fullName}</span>
            <span className="block text-xs text-muted-foreground">{item.referenceNumber}</span>
          </span>
        </button>
        {status.label !== 'Active' ? (
          <span className="mt-1 block">
            <StatusBadge label={status.label} tone={status.tone} />
          </span>
        ) : null}
      </td>
      <td className="whitespace-nowrap px-2 py-3 text-[13px]">
        {item.hostelName
          ? `${item.hostelName}${item.roomNumber ? ` · ${item.roomNumber}` : ''}`
          : '—'}
      </td>
      <td className="px-2 py-3 text-[13px]">
        {item.department} · {item.academicYear}
      </td>
      <td className="px-2 py-3">
        <MealDots defaults={item.mealDefaults} />
      </td>
      <td className="px-2 py-3">
        <NoShowCounts
          counts={item.noShowCounts}
          warningThreshold={data.noShowWarningThreshold}
          disableThreshold={data.noShowDisableThreshold}
        />
      </td>
      <td className="px-2 py-3">
        {item.isOnLeaveToday ? (
          <StatusBadge label="On leave" tone="info" />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-1 py-3" onClick={(event) => event.stopPropagation()}>
        <Button
          size="icon"
          variant="ghost"
          asChild
          aria-label={`Open full profile for ${item.fullName}`}
        >
          <Link to={`/students/${item.rosterEntryId}`}>
            <MoreHorizontal aria-hidden />
          </Link>
        </Button>
      </td>
    </tr>
  );
}

function MoveDialog({
  ids,
  onClose,
  onMoved,
}: {
  ids: string[];
  onClose: () => void;
  onMoved: () => void;
}) {
  const [targetBlockId, setTargetBlockId] = useState('');
  const hostels = useQuery({ queryKey: ['hostels'], queryFn: listHostels });
  const blocks = (hostels.data ?? []).flatMap((hostel) =>
    hostel.blocks
      .filter((block) => block.isActive)
      .map((block) => ({ ...block, label: `${hostel.name} • ${block.name}` })),
  );
  const move = useMutation({
    mutationFn: (reason: string) => bulkUpdateHostel(ids, targetBlockId, reason),
    onSuccess: ({ updated }) => {
      toast.success(`${updated} students moved.`);
      onMoved();
    },
  });
  return (
    <ReasonDialog
      open
      onOpenChange={(isOpen) => (isOpen ? undefined : onClose())}
      title={`Move ${ids.length} students`}
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
          {blocks.map((block) => (
            <option key={block.id} value={block.id}>
              {block.label}
            </option>
          ))}
        </Select>
      </Field>
    </ReasonDialog>
  );
}

const WIDE_QUERY = '(min-width: 1280px)';
/** Matches Tailwind's `xl`, where the table and the details panel fit side by side. */
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

/** Admin UX standards: CSV of the students on screen. */
function exportPage(items: AdminStudentListItem[]) {
  const mealText = (item: AdminStudentListItem, pick: 'defaults' | 'noShows') =>
    (['BREAKFAST', 'LUNCH', 'DINNER'] as const)
      .map((meal) =>
        pick === 'defaults'
          ? `${MEAL_NAMES[meal]} ${item.mealDefaults?.[meal] ?? '-'}`
          : `${MEAL_NAMES[meal]} ${item.noShowCounts?.[meal] ?? '-'}`,
      )
      .join('; ');
  const rows = items.map((item) => [
    item.fullName,
    item.referenceNumber,
    item.hostelName ?? '',
    item.blockName ?? '',
    item.roomNumber ?? '',
    item.department,
    item.academicYear,
    describeStudentStatus(item).label,
    mealText(item, 'defaults'),
    mealText(item, 'noShows'),
    item.isOnLeaveToday ? 'On leave' : '',
  ]);
  saveCsv(
    'students.csv',
    toCsv(
      [
        'Name',
        'Reference number',
        'Hostel',
        'Block',
        'Room',
        'Department',
        'Year',
        'Status',
        'Default Booking',
        'No-shows',
        'Leave',
      ],
      rows,
    ),
  );
}
