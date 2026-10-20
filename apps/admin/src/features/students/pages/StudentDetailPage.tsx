import {
  type AdminStudentDetail,
  type CredentialResetIssued,
  MEAL_TYPE_ORDER,
} from '@ennel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router';
import { toast } from 'sonner';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { EmptyState, QueryBoundary } from '@/shared/components/QueryStates';
import { ReasonDialog } from '@/shared/components/ReasonDialog';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardHeader } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogFooter } from '@/shared/components/ui/dialog';
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
        onOpenChange={(open) => !open && setPending(null)}
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
  const isDeactivated = !student.isRosterActive || student.status === 'DEACTIVATED';
  return (
    <>
      <PermissionGate permissions={['students:update']}>
        <Button variant="outline" onClick={onEdit}>
          Edit college details
        </Button>
      </PermissionGate>
      {student.isRegistered ? (
        <PermissionGate permissions={['students:reset-credentials']}>
          <Button
            variant="outline"
            onClick={() => onAction({ kind: 'reset', resetKind: 'PASSWORD' })}
          >
            Password reset code
          </Button>
          <Button
            variant="outline"
            onClick={() => onAction({ kind: 'reset', resetKind: 'REGISTRATION' })}
          >
            Registration reset code
          </Button>
        </PermissionGate>
      ) : null}
      {student.isRegistered && !isDeactivated ? (
        <PermissionGate permissions={['students:lock']}>
          <Button
            variant="outline"
            onClick={() =>
              onAction({ kind: 'access', action: student.status === 'LOCKED' ? 'unlock' : 'lock' })
            }
          >
            {student.status === 'LOCKED' ? 'Unlock' : 'Lock'}
          </Button>
        </PermissionGate>
      ) : null}
      <PermissionGate permissions={['students:deactivate']}>
        <Button
          variant={isDeactivated ? 'default' : 'destructive'}
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
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Profile"
          actions={<StatusBadge label={status.label} tone={status.tone} />}
        />
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <Detail label="Department" value={student.department} />
          <Detail label="Year" value={String(student.academicYear)} />
          <Detail
            label="Hostel"
            value={student.blockName ? `${student.hostelName} • ${student.blockName}` : '—'}
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
        <CardHeader
          title="Default Booking"
          description={
            student.defaultBookingEnabled === null
              ? undefined
              : `Overall switch: ${student.defaultBookingEnabled ? 'ON' : 'OFF'}`
          }
        />
        {student.preferences.length === 0 ? (
          <EmptyState title="No preferences yet" />
        ) : (
          <ul className="space-y-2 text-sm">
            {student.preferences.map((preference) => (
              <li
                key={preference.mealType}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span className="font-medium">{MEAL_NAMES[preference.mealType]}</span>
                <span className="flex items-center gap-2">
                  {preference.isEnabled
                    ? `ON • ${preference.slotLabel ?? ''} • ${preference.dietType === 'VEG' ? 'Veg' : 'Non-Veg'}`
                    : 'OFF'}
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
        <p className="mt-3 text-sm text-muted-foreground">
          Complaints submitted: {student.complaintsCount}
        </p>
      </Card>
      <Card>
        <CardHeader title="Leaves" />
        {student.leaves.length === 0 ? (
          <EmptyState title="No leaves" />
        ) : (
          <ul className="space-y-1 text-sm">
            {student.leaves.map((leave) => (
              <li key={leave.id}>
                {formatBusinessDate(leave.startDate)} {MEAL_NAMES[leave.startMealType]} →{' '}
                {formatBusinessDate(leave.endDate)} {MEAL_NAMES[leave.endMealType]} · {leave.status}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader title="Recent bookings" />
        {student.recentBookings.length === 0 ? (
          <EmptyState title="No bookings yet" />
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Recent bookings</caption>
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1">Date</th>
                <th>Meal</th>
                <th>Slot</th>
                <th>Status</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {student.recentBookings.map((booking) => (
                <tr key={booking.id} className="border-t border-border">
                  <td className="py-1">{formatBusinessDate(booking.mealDate)}</td>
                  <td>{MEAL_NAMES[booking.mealType]}</td>
                  <td>{booking.slotLabel}</td>
                  <td>{booking.status}</td>
                  <td>{booking.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </>
  );
}
