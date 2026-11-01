import {
  type AdminStudentDetail,
  type BookingStatus,
  MEAL_TYPE_ORDER,
  type MealType,
} from '@ennel/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { ChoiceChip } from '@/shared/components/ChoiceChip';
import { ErrorState, LoadingState } from '@/shared/components/QueryStates';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { formatBusinessDate, todayBusinessDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { BOOKING_STATUS_DISPLAY } from '@/features/bookings/constants/booking-display';
import { getStudent } from '../api/students-api';
import { initials, MEAL_NAMES } from './student-cells';
import { describeStudentStatus } from './student-status';

type Tab = 'bookings' | 'leave' | 'complaints';

/** Figma "Student details" side panel (Admin §G); actions stay on the full profile page. */
export function StudentDetailsPanel({ id }: { id: string }) {
  const student = useQuery({ queryKey: ['student', id], queryFn: () => getStudent(id) });
  if (student.isLoading) return <LoadingState label="Loading student…" />;
  if (student.error)
    return <ErrorState error={student.error} onRetry={() => void student.refetch()} />;
  return student.data ? <Details student={student.data} /> : null;
}

const startOf = (label: string | null) => (label ? (label.split(' - ')[0] ?? label) : null);

function defaultSummary(student: AdminStudentDetail): string {
  if (!student.isRegistered) return 'Not registered yet';
  return MEAL_TYPE_ORDER.map((meal) => {
    const state = student.mealDefaults?.[meal] ?? 'OFF';
    const preference = student.preferences.find((item) => item.mealType === meal);
    if (state === 'ON')
      return `${MEAL_NAMES[meal]} ${startOf(preference?.slotLabel ?? null) ?? ''}`.trim();
    return `${MEAL_NAMES[meal]} ${state === 'AUTO_OFF' ? 'off (No-shows)' : 'off'}`;
  }).join(' · ');
}

function Details({ student }: { student: AdminStudentDetail }) {
  const status = describeStudentStatus(student);
  const autoOff = MEAL_TYPE_ORDER.filter((meal) => student.mealDefaults?.[meal] === 'AUTO_OFF');
  const today = todayBusinessDate();
  const nextLeave = student.leaves
    .filter((leave) => leave.status === 'APPROVED' && leave.startDate > today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground"
        >
          {initials(student.fullName)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[17px] font-semibold">{student.fullName}</p>
          <p className="text-xs text-muted-foreground">
            {student.referenceNumber} · {student.department} · Year {student.academicYear}
          </p>
        </div>
        <span className="ml-auto">
          <StatusBadge label={status.label} tone={status.tone} />
        </span>
      </div>
      <Fact
        label="Hostel"
        value={
          student.blockName
            ? `${student.hostelName} · ${student.blockName}${student.roomNumber ? ` · Room ${student.roomNumber}` : ''}`
            : 'Not set'
        }
      />
      <Fact label="Default booking" value={defaultSummary(student)} />
      <Fact
        label="Leave"
        value={
          student.isOnLeaveToday
            ? 'On leave today'
            : nextLeave
              ? `Next leave from ${formatBusinessDate(nextLeave.startDate, 'EEE d MMM')}`
              : 'Not on leave'
        }
      />
      {student.isRegistered ? <NoShowMeters student={student} autoOff={autoOff} /> : null}
      <Activity student={student} />
      <Button variant="outline" asChild>
        <Link to={`/students/${student.rosterEntryId}`}>Open full profile and actions</Link>
      </Button>
      <p className="text-xs text-muted-foreground">
        College fields come from the roster. Corrections, locking and resets are on the full profile
        and are audited.
      </p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

/** BR-NS-3/5: counts against the disable threshold in the rolling window. */
function NoShowMeters({ student, autoOff }: { student: AdminStudentDetail; autoOff: MealType[] }) {
  const limit = student.noShowDisableThreshold;
  return (
    <section className="flex flex-col gap-2 rounded-lg bg-warning-surface p-3.5">
      <h3 className="text-[13px] font-semibold">No-shows · last {student.noShowWindowDays} days</h3>
      {MEAL_TYPE_ORDER.map((meal) => {
        const count = student.noShowCounts[meal] ?? 0;
        const isAtLimit = count >= limit;
        return (
          <div key={meal} className="flex items-center gap-2 text-[13px]">
            <span className="w-[70px]">{MEAL_NAMES[meal]}</span>
            <span
              role="meter"
              aria-label={`${MEAL_NAMES[meal]} No-shows`}
              aria-valuemin={0}
              aria-valuemax={limit}
              aria-valuenow={count}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-background"
            >
              <span
                className={cn(
                  'block h-full rounded-full',
                  isAtLimit ? 'bg-danger' : count > 0 ? 'bg-warning' : 'bg-primary',
                )}
                style={{ width: `${Math.min(100, (count / limit) * 100)}%` }}
              />
            </span>
            <span className={cn('font-semibold', isAtLimit && 'text-danger')}>
              {count}/{limit}
            </span>
          </div>
        );
      })}
      {autoOff.length > 0 ? (
        <p className="text-xs font-medium text-danger">
          Default Booking off for {autoOff.map((meal) => MEAL_NAMES[meal]).join(' and ')} after
          No-shows
        </p>
      ) : null}
    </section>
  );
}

function Activity({ student }: { student: AdminStudentDetail }) {
  const [tab, setTab] = useState<Tab>('bookings');
  return (
    <section className="flex flex-col gap-2.5">
      <div role="radiogroup" aria-label="Recent activity" className="flex flex-wrap gap-1.5">
        <ChoiceChip
          label="Bookings"
          isSelected={tab === 'bookings'}
          onClick={() => setTab('bookings')}
        />
        <ChoiceChip label="Leave" isSelected={tab === 'leave'} onClick={() => setTab('leave')} />
        <ChoiceChip
          label="Complaints"
          isSelected={tab === 'complaints'}
          onClick={() => setTab('complaints')}
        />
      </div>
      {tab === 'bookings' ? (
        student.recentBookings.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No bookings yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {student.recentBookings.slice(0, 5).map((booking) => {
              const display = BOOKING_STATUS_DISPLAY[booking.status as BookingStatus] ?? {
                label: booking.status,
                tone: 'neutral' as const,
              };
              return (
                <li key={booking.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold">
                      {formatBusinessDate(booking.mealDate, 'EEE d')} ·{' '}
                      {MEAL_NAMES[booking.mealType]}
                    </p>
                    <p className="text-xs text-muted-foreground">{booking.slotLabel}</p>
                  </div>
                  <StatusBadge label={display.label} tone={display.tone} />
                </li>
              );
            })}
          </ul>
        )
      ) : null}
      {tab === 'leave' ? (
        student.leaves.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No leave.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-[13px]">
            {student.leaves.slice(0, 5).map((leave) => (
              <li key={leave.id}>
                {formatBusinessDate(leave.startDate, 'EEE d MMM')} {MEAL_NAMES[leave.startMealType]}{' '}
                – {formatBusinessDate(leave.endDate, 'EEE d MMM')} {MEAL_NAMES[leave.endMealType]}
                <span className="text-muted-foreground"> · {leave.status.toLowerCase()}</span>
              </li>
            ))}
          </ul>
        )
      ) : null}
      {tab === 'complaints' ? (
        <p className="text-[13px] text-muted-foreground">
          {student.complaintsCount === 0
            ? 'No identified complaints.'
            : `${student.complaintsCount} identified complaint(s). Anonymous reports are never linked to a student.`}
        </p>
      ) : null}
    </section>
  );
}
