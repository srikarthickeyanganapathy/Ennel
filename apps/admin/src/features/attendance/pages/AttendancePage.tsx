import {
  type AttendanceCounter,
  type AttendanceWindowQuery,
  MEAL_TYPE_ORDER,
  type MealType,
} from '@ennel/shared';
import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { QueryBoundary } from '@/shared/components/QueryStates';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Card, CardHeader } from '@/shared/components/ui/card';
import { Input, Label, Select } from '@/shared/components/ui/form-controls';
import { PageHeader } from '@/shared/layout/PageHeader';
import { formatDateTime } from '@/shared/lib/format';
import { getActiveWindow, getCounter } from '../api/attendance-api';
import { AttendanceImportCard } from '../components/AttendanceImportCard';
import { CounterSearch } from '../components/CounterSearch';
import { OutageControl } from '../components/OutageControl';
import { MEAL_NAMES, PHASE_TEXT, SOURCE_TEXT } from '../constants/attendance-labels';

/** Live counts refresh this often while the page is open (Admin §I "live counter"). */
const LIVE_REFRESH_MS = 15_000;

/** Admin §I: the attendance counter for one meal window. */
export function AttendancePage() {
  const active = useQuery({ queryKey: ['attendance-active'], queryFn: getActiveWindow });
  return (
    <div>
      <PageHeader
        title="Attendance"
        breadcrumbs={[{ label: 'Attendance' }]}
        description="Mark students present at the counter and follow attended vs booked meals."
      />
      <QueryBoundary
        isLoading={active.isLoading}
        error={active.error}
        onRetry={() => void active.refetch()}
      >
        {active.data ? <AttendanceWindow initial={active.data} /> : null}
      </QueryBoundary>
    </div>
  );
}

function AttendanceWindow({ initial }: { initial: AttendanceWindowQuery }) {
  const id = useId();
  const [target, setTarget] = useState(initial);
  const counter = useQuery({
    queryKey: ['attendance-counter', target],
    queryFn: () => getCounter(target),
    refetchInterval: LIVE_REFRESH_MS,
  });

  return (
    <div className="space-y-4">
      <OutageControl />
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-date`}>Date</Label>
          <Input
            id={`${id}-date`}
            type="date"
            value={target.date}
            onChange={(event) =>
              event.target.value && setTarget({ ...target, date: event.target.value })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-meal`}>Meal</Label>
          <Select
            id={`${id}-meal`}
            value={target.mealType}
            onChange={(event) => setTarget({ ...target, mealType: event.target.value as MealType })}
          >
            {MEAL_TYPE_ORDER.map((meal) => (
              <option key={meal} value={meal}>
                {MEAL_NAMES[meal]}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <QueryBoundary
        isLoading={counter.isLoading}
        error={counter.error}
        onRetry={() => void counter.refetch()}
      >
        {counter.data ? <CounterView counter={counter.data} /> : null}
      </QueryBoundary>
      <CounterSearch target={target} />
      <PermissionGate permissions={['attendance:import']}>
        <AttendanceImportCard target={target} />
      </PermissionGate>
    </div>
  );
}

function CounterView({ counter }: { counter: AttendanceCounter }) {
  const phaseTone = counter.phase === 'OPEN' ? 'success' : 'neutral';
  return (
    <Card>
      <CardHeader
        title={`${counter.mealName}: ${counter.totals.attended} of ${counter.totals.booked} attended`}
        description={`${formatDateTime(counter.opensAt)} – ${formatDateTime(counter.closesAt)}${counter.totals.noShow > 0 ? ` · ${counter.totals.noShow} No-shows` : ''}`}
        actions={
          <StatusBadge
            label={counter.isFinalised ? 'Finalised' : PHASE_TEXT[counter.phase]}
            tone={phaseTone}
          />
        }
      />
      {counter.slots.length === 0 ? (
        <p className="text-sm text-muted-foreground">No bookings for this meal.</p>
      ) : (
        <ul className="space-y-2">
          {counter.slots.map((slot) => {
            const percent = slot.booked === 0 ? 0 : Math.round((slot.attended / slot.booked) * 100);
            return (
              <li key={slot.slotId}>
                <div className="flex justify-between text-sm">
                  <span>{slot.label}</span>
                  <span>
                    {slot.attended} / {slot.booked} attended ({percent}%)
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-surface" aria-hidden="true">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${percent}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {counter.recent.length > 0 ? (
        <div className="mt-4">
          <h3 className="mb-1 text-sm font-semibold">Recently recorded</h3>
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
        </div>
      ) : null}
    </Card>
  );
}
