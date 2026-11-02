import { StaffRole, type StaffUser } from '@ennel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage, isVersionConflict } from '@/shared/api-client/api-error';
import { ChoiceChip } from '@/shared/components/ChoiceChip';
import { DataTable, type DataTableColumnMeta } from '@/shared/components/DataTable';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { ReasonDialog } from '@/shared/components/ReasonDialog';
import { StatusBadge, type StatusTone } from '@/shared/components/StatusBadge';
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
  listRoles,
  listStaff,
  resetStaffPassword,
  resetStaffTotp,
  setStaffEnabled,
  setStaffRoles,
} from '../api/staff-api';
import { CreateStaffDialog } from '../components/CreateStaffDialog';
import { PermissionMatrixCard } from '../components/PermissionMatrixCard';
import { TemporaryPasswordDialog } from '../components/TemporaryPasswordDialog';
import { ROLE_LABELS, ROLE_SHORT_LABELS } from '../constants/role-labels';

type PendingAction =
  | { kind: 'disable' | 'enable' | 'reset-password' | 'reset-totp'; staff: StaffUser }
  | { kind: 'roles'; staff: StaffUser; roles: StaffRole[] };

const STATUSES = {
  ACTIVE: { label: 'Active', tone: 'success' },
  LOCKED: { label: 'Locked', tone: 'warning' },
  DISABLED: { label: 'Disabled', tone: 'danger' },
} as const;
const ROLE_TONES: Record<StaffRole, StatusTone> = {
  SUPER_ADMIN: 'success',
  MESS_MANAGER: 'success',
  MESS_STAFF: 'warning',
  WARDEN: 'info',
  AUDITOR: 'neutral',
};
const meta = (exportValue: (row: StaffUser) => string): DataTableColumnMeta => ({
  exportValue: (row) => exportValue(row as StaffUser),
});

/** Figma "Admin — Staff & roles": the staff directory and permission summary (Admin §A/§B). */
export function StaffPage() {
  const queryClient = useQueryClient();
  const { me } = useAuth();
  const table = useTableState();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState<StaffRole | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [password, setPassword] = useState<{ email: string; value: string } | null>(null);

  const query = {
    ...table.state,
    q: q || undefined,
    status: (status || undefined) as StaffUser['status'] | undefined,
    role: role ?? undefined,
  };
  const staff = useQuery({ queryKey: ['staff', query], queryFn: () => listStaff(query) });
  const everyone = useQuery({
    queryKey: ['staff', 'count'],
    queryFn: () => listStaff({ page: 1, pageSize: 1 }),
  });
  const roles = useQuery({ queryKey: ['roles'], queryFn: listRoles });
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
    // Close and reload so the next attempt starts from the colleague's roles and version.
    onError: (error) => {
      if (!isVersionConflict(error)) return;
      toast.error(`${errorMessage(error)} The list has been reloaded.`);
      setPending(null);
      refresh();
    },
  });

  const { reset: resetAction } = action;
  const columns = useMemo<ColumnDef<StaffUser, unknown>[]>(
    () => [
      {
        id: 'fullName',
        header: 'Name',
        enableHiding: false,
        cell: ({ row }) => (
          <span className="block leading-tight">
            <span className="block text-[13px] font-semibold">{row.original.fullName}</span>
            <span className="block text-xs text-muted-foreground">{row.original.email}</span>
          </span>
        ),
        meta: meta((row) => `${row.fullName} (${row.email})`),
      },
      {
        id: 'roles',
        header: 'Role',
        cell: ({ row }) => (
          <span className="flex flex-wrap gap-1">
            {row.original.roles.map((key) => (
              <StatusBadge key={key} label={ROLE_SHORT_LABELS[key]} tone={ROLE_TONES[key]} />
            ))}
          </span>
        ),
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
        id: 'lastActiveAt',
        header: 'Last active',
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.lastActiveAt ? formatDateTime(row.original.lastActiveAt) : 'Never'}
          </span>
        ),
        meta: meta((row) => row.lastActiveAt ?? ''),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        enableHiding: false,
        cell: ({ row }) => (
          <StaffActions
            staff={row.original}
            isSelf={row.original.id === me?.id}
            onAction={(next) => (resetAction(), setPending(next))}
          />
        ),
      },
    ],
    [me?.id, resetAction],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Staff & roles"
        breadcrumbs={[{ label: 'Staff & roles' }]}
        actions={
          <PermissionGate permissions={['staff:manage', 'roles:manage']}>
            <Button className="h-12 font-semibold" onClick={() => setIsCreating(true)}>
              Add staff member
            </Button>
          </PermissionGate>
        }
      />
      <div role="radiogroup" aria-label="Filter by role" className="-mt-4 flex flex-wrap gap-2">
        <ChoiceChip
          label={everyone.data ? `All · ${everyone.data.total}` : 'All'}
          isSelected={role === null}
          onClick={() => (setRole(null), table.resetPage())}
        />
        {(roles.data ?? []).map((item) => (
          <ChoiceChip
            key={item.id}
            label={`${ROLE_SHORT_LABELS[item.key]} · ${item.staffCount}`}
            isSelected={role === item.key}
            onClick={() => (setRole(item.key), table.resetPage())}
          />
        ))}
      </div>
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
      {roles.data ? <PermissionMatrixCard roles={roles.data} /> : null}
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
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${staff.fullName}`}>
          <MoreHorizontal aria-hidden />
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
