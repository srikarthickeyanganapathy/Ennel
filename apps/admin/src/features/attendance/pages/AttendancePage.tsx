import {
  type AttendanceCounter,
  type AttendanceWindowQuery,
  MEAL_TYPE_ORDER,
  type NoShowAtRisk,
} from '@ennel/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { usePermissions } from '@/features/auth/auth-context';
import { AppealQueue, APPEALS_QUERY } from '@/features/no-shows/components/AppealQueue';
import { AtRiskCard } from '@/features/no-shows/components/AtRiskCard';
import { HeldQueue } from '@/features/no-shows/components/HeldQueue';
import {
  type NoShowAction,
  NoShowActionDialog,
} from '@/features/no-shows/components/NoShowActionDialog';
import { NoShowsTable } from '@/features/no-shows/components/NoShowsTable';
import { getAtRisk } from '@/features/no-shows/api/no-shows-api';
import { ChoiceChip } from '@/shared/components/ChoiceChip';
import { DatePickerButton } from '@/shared/components/DatePickerButton';
import { MealSwitcher } from '@/shared/components/MealSwitcher';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { QueryBoundary } from '@/shared/components/QueryStates';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Card, CardHeader } from '@/shared/components/ui/card';
import { PageHeader } from '@/shared/layout/PageHeader';
import { formatBusinessDate, formatDateTime, formatTime } from '@/shared/lib/format';
import { getActiveWindow, getCounter } from '../api/attendance-api';
import { AttendanceImportCard } from '../components/AttendanceImportCard';
import { CounterSearch } from '../components/CounterSearch';
import { OutageCard } from '../components/OutageCard';
import { SlotCountsTable } from '../components/SlotCountsTable';
import { MEAL_NAMES, PHASE_TEXT, SOURCE_TEXT } from '../constants/attendance-labels';

/** Live counts refresh this often while the page is open (Admin §I "live counter"). */
const LIVE_REFRESH_MS = 15_000;
const MEALS = MEAL_TYPE_ORDER.map((mealType) => ({ mealType, mealName: MEAL_NAMES[mealType] }));

type Tab = 'today' | 'no-shows' | 'appeals';

/** Figma "Admin — Attendance & No-shows": the live counter (Admin §I) and No-show review (§J). */
export function AttendancePage() {
  const can = usePermissions();
  const canCount = can('attendance:read');
  const canReview = can('no-shows:read');
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  // Counter staff cannot read No-shows, and a custom role could read only No-shows.
  const tab: Tab =
    canReview && (requested === 'no-shows' || requested === 'appeals' || !canCount)
      ? requested === 'appeals'
        ? 'appeals'
        : 'no-shows'
      : 'today';
  const [picked, setPicked] = useState<AttendanceWindowQuery | null>(null);
  const [action, setAction] = useState<NoShowAction | null>(null);
  const active = useQuery({
    queryKey: ['attendance-active'],
    queryFn: getActiveWindow,
    enabled: canCount,
  });
  const atRisk = useQuery({
    queryKey: ['admin-no-shows', 'at-risk'],
    queryFn: getAtRisk,
    enabled: canReview,
  });
  const appeals = useQuery({ ...APPEALS_QUERY, enabled: canReview });
  const target = picked ?? active.data ?? null;
  const windowDays = atRisk.data?.windowDays ?? null;
  const toReview = appeals.data ? appeals.data.pendingAppeals + appeals.data.heldForReview : null;

  return (
    <div>
      <PageHeader
        title="Attendance & No-shows"
        breadcrumbs={[{ label: 'Attendance' }]}
        description={
          windowDays
            ? `Live counts for the meal window · rolling ${windowDays}-day No-shows`
            : 'Live counts for the meal window'
        }
        actions={
          tab === 'today' && target ? (
            <>
              <DatePickerButton
                value={target.date}
                text={formatBusinessDate(target.date, 'EEE, d MMM yyyy')}
                label="Attendance date"
                onChange={(date) => date && setPicked({ ...target, date })}
              />
              <MealSwitcher
                meals={MEALS}
                selected={target.mealType}
                onChange={(mealType) => setPicked({ ...target, mealType })}
              />
            </>
          ) : null
        }
      />
      {canReview ? (
        <div role="radiogroup" aria-label="View" className="mb-6 flex flex-wrap gap-2">
          {canCount ? (
            <ChoiceChip
              label="Today"
              isSelected={tab === 'today'}
              onClick={() => setParams({}, { replace: true })}
            />
          ) : null}
          <ChoiceChip
            label={windowDays ? `No-shows · ${windowDays} days` : 'No-shows'}
            isSelected={tab === 'no-shows'}
            onClick={() => setParams({ tab: 'no-shows' }, { replace: true })}
          />
          <ChoiceChip
            label={toReview === null ? 'Appeals' : `Appeals · ${toReview}`}
            isSelected={tab === 'appeals'}
            onClick={() => setParams({ tab: 'appeals' }, { replace: true })}
          />
        </div>
      ) : null}
      {tab === 'today' ? (
        <QueryBoundary
          isLoading={active.isLoading}
          error={active.error}
          onRetry={() => void active.refetch()}
        >
          {target ? (
            <TodayView target={target} atRisk={atRisk.data ?? null} onAction={setAction} />
          ) : null}
        </QueryBoundary>
      ) : null}
      {tab === 'no-shows' && windowDays ? (
        <NoShowsTable windowDays={windowDays} onAction={setAction} />
      ) : null}
      {tab === 'appeals' ? (
        <div className="flex flex-col gap-4">
          <AppealQueue onAction={setAction} />
          <HeldQueue onAction={setAction} />
        </div>
      ) : null}
      <NoShowActionDialog
        key={action ? `${action.kind}-${action.event.id}` : 'none'}
        action={action}
        onClose={() => setAction(null)}
      />
    </div>
  );
}

function TodayView({
  target,
  atRisk,
  onAction,
}: {
  target: AttendanceWindowQuery;
  atRisk: NoShowAtRisk | null;
  onAction: (action: NoShowAction) => void;
}) {
  const counter = useQuery({
    queryKey: ['attendance-counter', target],
    queryFn: () => getCounter(target),
    refetchInterval: LIVE_REFRESH_MS,
  });
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-6">
        <CounterSearch target={target} />
        <QueryBoundary
          isLoading={counter.isLoading}
          error={counter.error}
          onRetry={() => void counter.refetch()}
        >
          {counter.data ? <CounterView counter={counter.data} /> : null}
        </QueryBoundary>
        <PermissionGate permissions={['no-shows:read']}>
          <section className="flex flex-col gap-4">
            <h2 className="text-base font-semibold">No-show appeals</h2>
            <AppealQueue onAction={onAction} />
          </section>
        </PermissionGate>
      </div>
      <div className="flex min-w-0 flex-col gap-6">
        <OutageCard />
        {atRisk ? <AtRiskCard atRisk={atRisk} /> : null}
        <PermissionGate permissions={['attendance:import']}>
          <AttendanceImportCard target={target} />
        </PermissionGate>
      </div>
    </div>
  );
}

function CounterView({ counter }: { counter: AttendanceCounter }) {
  const { totals } = counter;
  return (
    <>
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">{counter.mealName} · by slot</h2>
            <p className="text-xs text-muted-foreground">
              {totals.attended} of {totals.booked} attended
              {totals.noShow > 0 ? ` · ${totals.noShow} No-shows` : ''} ·{' '}
              {formatTime(counter.opensAt)} – {formatTime(counter.closesAt)}
            </p>
          </div>
          <StatusBadge
            label={counter.isFinalised ? 'Finalised' : PHASE_TEXT[counter.phase]}
            tone={counter.phase === 'OPEN' ? 'success' : 'neutral'}
          />
        </div>
        <SlotCountsTable counter={counter} />
      </section>
      {counter.recent.length > 0 ? (
        <Card>
          <CardHeader title="Recently recorded" />
          <ul className="divide-y divide-border text-sm">
            {counter.recent.map((mark) => (
              <li
                key={`${mark.referenceNumber}-${mark.recordedAt}`}
                className="flex flex-wrap justify-between gap-2 py-1.5"
              >
                <span>
                  {mark.studentName}{' '}
                  <span className="text-muted-foreground">{mark.referenceNumber}</span>
                </span>
                <span className="text-muted-foreground">
                  {SOURCE_TEXT[mark.source]}
                  {mark.recordedByName ? ` by ${mark.recordedByName}` : ''},{' '}
                  {formatDateTime(mark.recordedAt)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
