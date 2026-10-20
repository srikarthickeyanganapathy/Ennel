import { StaffRole, type StaffUser } from '@ennel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { DataTable, type DataTableColumnMeta } from '@/shared/components/DataTable';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { ReasonDialog } from '@/shared/components/ReasonDialog';
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
import { formatDateTime } from '@/shared/lib/format';
import { useAuth } from '@/features/auth/auth-context';
import {
  listStaff,
  resetStaffPassword,
  resetStaffTotp,
  setStaffEnabled,
  setStaffRoles,
} from '../api/staff-api';
import { CreateStaffDialog } from '../components/CreateStaffDialog';
import { TemporaryPasswordDialog } from '../components/TemporaryPasswordDialog';
import { ROLE_LABELS } from '../constants/role-labels';

type PendingAction =
  | { kind: 'disable' | 'enable' | 'reset-password' | 'reset-totp'; staff: StaffUser }
  | { kind: 'roles'; staff: StaffUser; roles: StaffRole[] };

const STATUSES = {
  ACTIVE: { label: 'Active', tone: 'success' },
  LOCKED: { label: 'Locked', tone: 'warning' },
  DISABLED: { label: 'Disabled', tone: 'danger' },
} as const;
const meta = (exportValue: (row: StaffUser) => string): DataTableColumnMeta => ({
  exportValue: (row) => exportValue(row as StaffUser),
});

/** Staff directory (Admin §A/§B). */
export function StaffPage() {
  const queryClient = useQueryClient();
  const { me } = useAuth();
  const table = useTableState();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [password, setPassword] = useState<{ email: string; value: string } | null>(null);

  const query = {
    ...table.state,
    q: q || undefined,
    status: (status || undefined) as StaffUser['status'] | undefined,
  };
  const staff = useQuery({ queryKey: ['staff', query], queryFn: () => listStaff(query) });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['staff'] });

  const action = useMutation({
    mutationFn: async ({ target, reason }: { target: PendingAction; reason: string }) => {
      const { staff: member } = target;
      if (target.kind === 'roles')
        return setStaffRoles(member.id, target.roles, reason, member.version);
      if (target.kind === 'reset-password') return resetStaffPassword(member.id, reason);
      if (target.kind === 'reset-totp') return resetStaffTotp(member.id, reason);
      return setStaffEnabled(member.id, target.kind === 'enable', reason);
    },
    onSuccess: (result) => {
      if (result && 'temporaryPassword' in result)
        setPassword({ email: result.staff.email, value: result.temporaryPassword });
      else toast.success('Saved.');
      setPending(null);
      refresh();
    },
  });

  const columns = useMemo<ColumnDef<StaffUser, unknown>[]>(
    () => [
      {
        id: 'fullName',
        header: 'Name',
        accessorKey: 'fullName',
        enableHiding: false,
        meta: meta((row) => row.fullName),
      },
      { id: 'email', header: 'Email', accessorKey: 'email', meta: meta((row) => row.email) },
      {
        id: 'roles',
        header: 'Roles',
        cell: ({ row }) => row.original.roles.map((role) => ROLE_LABELS[role]).join(', '),
        meta: meta((row) => row.roles.join(' ')),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <span className="flex flex-wrap gap-1">
            <StatusBadge {...STATUSES[row.original.status]} />
            {row.original.mustChangePassword ? (
              <StatusBadge label="Password change pending" tone="info" />
            ) : null}
            {row.original.totpEnabled ? <StatusBadge label="2FA on" tone="success" /> : null}
          </span>
        ),
        meta: meta((row) => row.status),
      },
      {
        id: 'createdAt',
        header: 'Added',
        cell: ({ row }) => formatDateTime(row.original.createdAt),
        meta: meta((row) => row.createdAt),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableHiding: false,
        cell: ({ row }) => (
          <StaffActions
            staff={row.original}
            isSelf={row.original.id === me?.id}
            onAction={setPending}
          />
        ),
      },
    ],
    [me?.id],
  );

  return (
    <div>
      <PageHeader
        title="Staff"
        breadcrumbs={[{ label: 'Staff & roles' }]}
        actions={
          <>
            <PermissionGate permissions={['roles:manage']}>
              <Button variant="outline" asChild>
                <Link to="/staff/roles">Role permissions</Link>
              </Button>
            </PermissionGate>
            <PermissionGate permissions={['staff:manage', 'roles:manage']}>
              <Button onClick={() => setIsCreating(true)}>Add staff member</Button>
            </PermissionGate>
          </>
        }
      />
      <DataTable
        caption="Staff members"
        columns={columns}
        rows={staff.data?.items ?? []}
        total={staff.data?.total ?? 0}
        state={table.state}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        getRowId={(row) => row.id}
        isLoading={staff.isLoading}
        error={staff.error}
        onRetry={() => void staff.refetch()}
        emptyTitle="No staff match these filters"
        exportFileName="staff.csv"
        toolbar={
          <>
            <Input
              aria-label="Search staff"
              placeholder="Search name or email"
              className="w-64"
              value={q}
              onChange={(event) => (setQ(event.target.value), table.resetPage())}
            />
            <Select
              aria-label="Filter by status"
              className="w-40"
              value={status}
              onChange={(event) => (setStatus(event.target.value), table.resetPage())}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="LOCKED">Locked</option>
              <option value="DISABLED">Disabled</option>
            </Select>
          </>
        }
      />
      <CreateStaffDialog
        open={isCreating}
        onOpenChange={setIsCreating}
        onCreated={(result) => {
          setIsCreating(false);
          setPassword({ email: result.staff.email, value: result.temporaryPassword });
          refresh();
        }}
      />
      <TemporaryPasswordDialog
        email={password?.email ?? null}
        password={password?.value ?? null}
        onClose={() => setPassword(null)}
      />
      <ReasonDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending ? ACTION_TITLES[pending.kind](pending.staff.fullName) : ''}
        confirmLabel="Confirm"
        isDestructive={pending?.kind === 'disable'}
        isPending={action.isPending}
        error={action.error}
        onConfirm={(reason) => pending && action.mutate({ target: pending, reason })}
      >
        {pending?.kind === 'roles' ? (
          <RolePicker
            roles={pending.roles}
            onChange={(roles) => setPending({ ...pending, roles })}
          />
        ) : null}
      </ReasonDialog>
    </div>
  );
}

const ACTION_TITLES: Record<PendingAction['kind'], (name: string) => string> = {
  disable: (name) => `Disable ${name}?`,
  enable: (name) => `Enable ${name}?`,
  'reset-password': (name) => `Reset ${name}'s password?`,
  'reset-totp': (name) => `Reset two-factor sign-in for ${name}?`,
  roles: (name) => `Change roles for ${name}`,
};

function RolePicker({
  roles,
  onChange,
}: {
  roles: StaffRole[];
  onChange: (roles: StaffRole[]) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Roles</legend>
      {Object.values(StaffRole).map((role) => (
        <label key={role} className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={roles.includes(role)}
            onChange={(event) =>
              onChange(
                event.target.checked ? [...roles, role] : roles.filter((item) => item !== role),
              )
            }
          />
          {ROLE_LABELS[role]}
        </label>
      ))}
    </fieldset>
  );
}

function StaffActions({
  staff,
  isSelf,
  onAction,
}: {
  staff: StaffUser;
  isSelf: boolean;
  onAction: (action: PendingAction) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Actions for ${staff.fullName}`}>
          Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <PermissionGate permissions={['roles:manage']}>
          <DropdownMenuItem onSelect={() => onAction({ kind: 'roles', staff, roles: staff.roles })}>
            Change roles
          </DropdownMenuItem>
        </PermissionGate>
        <PermissionGate permissions={['staff:manage']}>
          <DropdownMenuItem onSelect={() => onAction({ kind: 'reset-password', staff })}>
            Reset password
          </DropdownMenuItem>
          {staff.totpEnabled ? (
            <DropdownMenuItem onSelect={() => onAction({ kind: 'reset-totp', staff })}>
              Reset two-factor
            </DropdownMenuItem>
          ) : null}
          {staff.status === 'DISABLED' ? (
            <DropdownMenuItem onSelect={() => onAction({ kind: 'enable', staff })}>
              Enable
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              disabled={isSelf}
              onSelect={() => onAction({ kind: 'disable', staff })}
            >
              {isSelf ? 'Disable (not your own account)' : 'Disable'}
            </DropdownMenuItem>
          )}
        </PermissionGate>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
