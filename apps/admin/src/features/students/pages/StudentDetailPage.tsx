import {
  type AdminStudentDetail,
  type BookingSource,
  type BookingStatus,
  type CredentialResetIssued,
  MEAL_TYPE_ORDER,
} from '@ennel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { toast } from 'sonner';
import {
  BOOKING_SOURCE_LABELS,
  BOOKING_STATUS_DISPLAY,
} from '@/features/bookings/constants/booking-display';
import { usePermissions } from '@/features/auth/auth-context';
import { DietTag } from '@/features/menus/components/DietTag';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { EmptyState, QueryBoundary } from '@/shared/components/QueryStates';
import { ReasonDialog } from '@/shared/components/ReasonDialog';
import { StatusBadge, type StatusTone } from '@/shared/components/StatusBadge';
import { TABLE_CELL, TABLE_HEAD } from '@/shared/components/table-styles';
import { Button } from '@/shared/components/ui/button';
import { Card, CardHeader } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogFooter } from '@/shared/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { PageHeader } from '@/shared/layout/PageHeader';
import { formatBusinessDate, formatDateTime } from '@/shared/lib/format';
import {
  changeStudentAccess,
  getStudent,
  issueCredentialReset,
  listHostels,
  type StudentAccessAction,
} from '../api/students-api';
import { EditStudentDialog } from '../components/EditStudentDialog';
import { describeStudentStatus } from '../components/student-status';

type PendingAction =
  | { kind: 'access'; action: StudentAccessAction }
  | { kind: 'reset'; resetKind: 'PASSWORD' | 'REGISTRATION' };

const MEAL_NAMES = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', DINNER: 'Dinner' } as const;
const LEAVE_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  PENDING: { label: 'Pending approval', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};
const ACCESS_TITLES: Record<StudentAccessAction, string> = {
  lock: 'Lock this account?',
  unlock: 'Unlock this account?',
  deactivate: 'Deactivate this student?',
  reactivate: 'Reactivate this student?',
};

/** Admin §G student detail: profile, preferences, bookings, leaves, no-shows and actions. */
export function StudentDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const student = useQuery({ queryKey: ['student', id], queryFn: () => getStudent(id) });
  const hostels = useQuery({ queryKey: ['hostels'], queryFn: listHostels });
  const [isEditing, setIsEditing] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [issued, setIssued] = useState<CredentialResetIssued | null>(null);

  const act = useMutation({
    mutationFn: async ({ target, reason }: { target: PendingAction; reason: string }) =>
      target.kind === 'access'
        ? changeStudentAccess(id, target.action, reason)
        : issueCredentialReset(id, { kind: target.resetKind, reason }),
    onSuccess: (result) => {
      setPending(null);
      if ('code' in result) setIssued(result);
      else {
        queryClient.setQueryData(['student', id], result);
        toast.success('Saved.');
      }
      void queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });

  const data = student.data;
  return (
    <div>
      <PageHeader
        title={data?.fullName ?? 'Student'}
        description={data ? `Reference number ${data.referenceNumber}` : undefined}
        breadcrumbs={[
          { label: 'Students', to: '/students' },
          { label: data?.fullName ?? 'Student' },
        ]}
        actions={
          data ? (
            <StudentActions
              student={data}
              onEdit={() => setIsEditing(true)}
              onAction={setPending}
            />
          ) : null
        }
      />
      <QueryBoundary
        isLoading={student.isLoading}
        error={student.error}
        onRetry={() => void student.refetch()}
      >
        {data ? <StudentSections student={data} /> : null}
      </QueryBoundary>
      {data ? (
        <EditStudentDialog
          student={data}
          hostels={hostels.data ?? []}
          open={isEditing}
          onOpenChange={setIsEditing}
        />
      ) : null}
      <ReasonDialog
        open={pending !== null}
        onOpenChange={(open) => !open && (act.reset(), setPending(null))}
        title={
          pending?.kind === 'access'
            ? ACCESS_TITLES[pending.action]
            : `Issue a ${pending?.resetKind === 'REGISTRATION' ? 'registration' : 'password'} reset code?`
        }
        description={
          pending?.kind === 'reset'
            ? 'A one-time code is shown once. Give it to the student in person; it expires in 24 hours.'
            : pending?.kind === 'access' &&
                (pending.action === 'lock' || pending.action === 'deactivate')
              ? 'The student is signed out of the app immediately.'
              : undefined
        }
        confirmLabel="Confirm"
        isDestructive={
          pending?.kind === 'access' &&
          (pending.action === 'lock' || pending.action === 'deactivate')
        }
        isPending={act.isPending}
        error={act.error}
        onConfirm={(reason) => pending && act.mutate({ target: pending, reason })}
      />
      <Dialog open={issued !== null} onOpenChange={(open) => !open && setIssued(null)}>
        <DialogContent
          title="Reset code"
          description={`Valid until ${formatDateTime(issued?.expiresAt)}. It will not be shown again.`}
        >
          <p
            className="rounded-md bg-surface p-3 text-center font-mono text-2xl tracking-widest"
            aria-label="Reset code"
          >
            {issued?.code}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            The student enters this code with their reference number in the app to set a new
            password.
          </p>
          <DialogFooter>
            <Button onClick={() => setIssued(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StudentActions({
  student,
  onEdit,
  onAction,
}: {
  student: AdminStudentDetail;
  onEdit: () => void;
  onAction: (action: PendingAction) => void;
}) {
  const can = usePermissions();
  const isDeactivated = !student.isRosterActive || student.status === 'DEACTIVATED';
  const canReset = student.isRegistered && can('students:reset-credentials');
  const canLock = student.isRegistered && !isDeactivated && can('students:lock');
  return (
    <>
      <PermissionGate permissions={['students:update']}>
        <Button className="h-11 font-semibold" onClick={onEdit}>
          Edit college details
        </Button>
      </PermissionGate>
      {canReset || canLock ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-11">
              Account actions
              <ChevronDown aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {canReset ? (
              <>
                <DropdownMenuItem
                  onSelect={() => onAction({ kind: 'reset', resetKind: 'PASSWORD' })}
                >
                  Password reset code
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => onAction({ kind: 'reset', resetKind: 'REGISTRATION' })}
                >
                  Registration reset code
                </DropdownMenuItem>
              </>
            ) : null}
            {canLock ? (
              <DropdownMenuItem
                onSelect={() =>
                  onAction({
                    kind: 'access',
                    action: student.status === 'LOCKED' ? 'unlock' : 'lock',
                  })
                }
              >
                {student.status === 'LOCKED' ? 'Unlock' : 'Lock'}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <PermissionGate permissions={['students:deactivate']}>
        <Button
          variant={isDeactivated ? 'outline' : 'dangerOutline'}
          className="h-11"
          onClick={() =>
            onAction({ kind: 'access', action: isDeactivated ? 'reactivate' : 'deactivate' })
          }
        >
          {isDeactivated ? 'Reactivate' : 'Deactivate'}
        </Button>
      </PermissionGate>
    </>
  );
}

function StudentSections({ student }: { student: AdminStudentDetail }) {
  const status = describeStudentStatus(student);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-6">
        <Card>
          <CardHeader
            title="Profile"
            actions={<StatusBadge label={status.label} tone={status.tone} />}
          />
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-[13px]">
            <Detail label="Department" value={student.department} />
            <Detail label="Year" value={String(student.academicYear)} />
            <Detail
              label="Hostel"
              value={student.blockName ? `${student.hostelName} · ${student.blockName}` : '—'}
            />
            <Detail label="Room" value={student.roomNumber ?? '—'} />
            <Detail label="Email" value={student.email ?? '—'} />
            <Detail label="Phone" value={student.phone ?? '—'} />
            <Detail label="Parent's phone" value={student.parentPhone ?? '—'} />
            <Detail label="Registered" value={formatDateTime(student.registeredAt)} />
            <Detail label="Setup completed" value={formatDateTime(student.onboardingCompletedAt)} />
          </dl>
        </Card>
        <Card>
          <CardHeader title="Leaves" />
          {student.leaves.length === 0 ? (
            <EmptyState title="No leaves" />
          ) : (
            <ul className="divide-y divide-border">
              {student.leaves.map((leave) => (
                <li
                  key={leave.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[13px] first:pt-0 last:pb-0"
                >
                  <span>
                    {formatBusinessDate(leave.startDate, 'EEE d MMM')}{' '}
                    {MEAL_NAMES[leave.startMealType]} →{' '}
                    {formatBusinessDate(leave.endDate, 'EEE d MMM')} {MEAL_NAMES[leave.endMealType]}
                  </span>
                  <StatusBadge
                    {...(LEAVE_STATUS[leave.status] ?? { label: leave.status, tone: 'neutral' })}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <div className="flex min-w-0 flex-col gap-6">
        <Card>
          <CardHeader
            title="Default Booking"
            description={
              student.defaultBookingEnabled === null
                ? undefined
                : `Overall switch: ${student.defaultBookingEnabled ? 'On' : 'Off'}`
            }
          />
          {student.preferences.length === 0 ? (
            <EmptyState title="No preferences yet" />
          ) : (
            <ul className="divide-y divide-border">
              {student.preferences.map((preference) => (
                <li
                  key={preference.mealType}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className="text-[13px] font-semibold">
                    {MEAL_NAMES[preference.mealType]}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-[13px]">
                    {preference.isEnabled ? (
                      <>
                        {preference.slotLabel ?? ''}
                        <DietTag diet={preference.dietType} />
                      </>
                    ) : (
                      <span className="text-muted-foreground">Off</span>
                    )}
                    {preference.isAutoDisabled ? (
                      <StatusBadge label="Disabled by No-shows" tone="warning" />
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader
            title="No-shows"
            description={`Last ${student.noShowWindowDays} days, counted per meal`}
          />
          <ul className="grid grid-cols-3 gap-3 text-center">
            {MEAL_TYPE_ORDER.map((mealType) => (
              <li key={mealType} className="rounded-md bg-surface p-3">
                <p className="text-2xl font-semibold">{student.noShowCounts[mealType] ?? 0}</p>
                <p className="text-xs text-muted-foreground">{MEAL_NAMES[mealType]}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] text-muted-foreground">
            Complaints submitted: {student.complaintsCount}
          </p>
        </Card>
      </div>
      <Card className="p-0 lg:col-span-2">
        <h2 className="px-5 pt-5 pb-3 text-base font-semibold">Recent bookings</h2>
        {student.recentBookings.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState title="No bookings yet" />
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <caption className="sr-only">Recent bookings</caption>
              <thead className="bg-neutral-surface">
                <tr>
                  <th scope="col" className={TABLE_HEAD}>
                    Date
                  </th>
                  <th scope="col" className={TABLE_HEAD}>
                    Meal
                  </th>
                  <th scope="col" className={TABLE_HEAD}>
                    Slot
                  </th>
                  <th scope="col" className={TABLE_HEAD}>
                    Status
                  </th>
                  <th scope="col" className={TABLE_HEAD}>
                    Source
                  </th>
                </tr>
              </thead>
              <tbody>
                {student.recentBookings.map((booking) => (
                  <tr key={booking.id} className="border-t border-border">
                    <td className={`${TABLE_CELL} font-semibold whitespace-nowrap`}>
                      {formatBusinessDate(booking.mealDate, 'EEE d MMM')}
                    </td>
                    <td className={TABLE_CELL}>{MEAL_NAMES[booking.mealType]}</td>
                    <td className={TABLE_CELL}>{booking.slotLabel}</td>
                    <td className={TABLE_CELL}>
                      <StatusBadge {...BOOKING_STATUS_DISPLAY[booking.status as BookingStatus]} />
                    </td>
                    <td className={TABLE_CELL}>
                      {BOOKING_SOURCE_LABELS[booking.source as BookingSource] ?? booking.source}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium">{value}</dd>
    </>
  );
}
