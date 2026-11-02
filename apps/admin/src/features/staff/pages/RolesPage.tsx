import {
  PERMISSION_DESCRIPTIONS,
  PERMISSION_KEYS,
  type PermissionKey,
  type Role,
  StaffRole,
} from '@ennel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fragment, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { QueryBoundary } from '@/shared/components/QueryStates';
import { ReasonDialog } from '@/shared/components/ReasonDialog';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Checkbox } from '@/shared/components/ui/form-controls';
import { PageHeader } from '@/shared/layout/PageHeader';
import { cn } from '@/shared/lib/utils';
import { listRoles, updateRolePermissions } from '../api/staff-api';

const HEAD = 'px-3 py-3 text-xs font-semibold whitespace-nowrap text-muted-foreground';
const STICKY = 'sticky left-0 z-10';

const GROUP_TITLES: Record<string, string> = {
  'no-shows': 'No-shows',
  'mess-config': 'Slots & capacity',
  'audit-log': 'Audit log',
};

/** Keys read "resource:action"; the resource groups the rows. */
const GROUPS = [...new Set(PERMISSION_KEYS.map((key) => key.split(':')[0] ?? key))].map((name) => ({
  name,
  title: GROUP_TITLES[name] ?? name.charAt(0).toUpperCase() + name.slice(1),
  keys: PERMISSION_KEYS.filter((key) => key.split(':')[0] === name),
}));

/** Role → permission matrix (Admin §A); only Super Admins (roles:manage) can change it. */
export function RolesPage() {
  const queryClient = useQueryClient();
  const roles = useQuery({ queryKey: ['roles'], queryFn: listRoles });
  const [draft, setDraft] = useState<Record<string, Set<PermissionKey>>>({});
  const [saving, setSaving] = useState<Role | null>(null);

  // Fills in roles that have no draft yet; unsaved edits to other roles survive a reload.
  useEffect(() => {
    if (!roles.data) return;
    const loaded = roles.data;
    setDraft((current) => ({
      ...Object.fromEntries(loaded.map((role) => [role.id, new Set(role.permissions)])),
      ...current,
    }));
  }, [roles.data]);

  const save = useMutation({
    mutationFn: ({ role, reason }: { role: Role; reason: string }) =>
      updateRolePermissions(role.id, [...(draft[role.id] ?? [])], reason),
    onSuccess: (role) => {
      toast.success(`${role.name} permissions saved.`);
      setSaving(null);
      setDraft((current) => ({ ...current, [role.id]: new Set(role.permissions) }));
      void queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });

  const toggle = (roleId: string, key: PermissionKey) =>
    setDraft((current) => {
      const next = new Set(current[roleId]);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...current, [roleId]: next };
    });

  const isChanged = (role: Role) => {
    const current = draft[role.id];
    return (
      current !== undefined &&
      (current.size !== role.permissions.length ||
        role.permissions.some((key) => !current.has(key)))
    );
  };
  const list = roles.data ?? [];

  return (
    <div>
      <PageHeader
        title="Role permissions"
        breadcrumbs={[{ label: 'Staff & roles', to: '/staff' }, { label: 'Role permissions' }]}
        description="Changes apply to every staff member with the role straight away."
      />
      <QueryBoundary
        isLoading={roles.isLoading}
        error={roles.error}
        onRetry={() => void roles.refetch()}
      >
        <Card className="relative overflow-x-auto p-0">
          <table className="w-full min-w-[820px]">
            <caption className="sr-only">Permissions by role</caption>
            <thead className="bg-neutral-surface">
              <tr>
                <th scope="col" className={cn(HEAD, STICKY, 'bg-neutral-surface pl-5 text-left')}>
                  Permission
                </th>
                {list.map((role) => (
                  <th key={role.id} scope="col" className={cn(HEAD, 'w-28 text-center')}>
                    {role.name}
                    <span className="block font-normal">{role.staffCount} staff</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((group) => (
                <Fragment key={group.name}>
                  <tr className="border-t border-border bg-surface">
                    <th
                      scope="colgroup"
                      colSpan={list.length + 1}
                      className="py-2 pl-5 text-left text-xs font-semibold text-muted-foreground"
                    >
                      {group.title}
                    </th>
                  </tr>
                  {group.keys.map((key) => (
                    <tr key={key} className="border-t border-border">
                      <th
                        scope="row"
                        className={cn(
                          STICKY,
                          'bg-background py-2.5 pr-3 pl-5 text-left font-normal',
                        )}
                      >
                        <span className="block text-[13px]">{PERMISSION_DESCRIPTIONS[key]}</span>
                        <code className="text-[11px] text-muted-foreground">{key}</code>
                      </th>
                      {list.map((role) => (
                        <td key={role.id} className="px-3 py-2.5 text-center">
                          <Checkbox
                            aria-label={`${role.name}: ${key}`}
                            checked={draft[role.id]?.has(key) ?? false}
                            disabled={role.key === StaffRole.SUPER_ADMIN}
                            onChange={() => toggle(role.id, key)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-surface">
                <td
                  className={cn(STICKY, 'bg-surface py-3 pr-3 pl-5 text-xs text-muted-foreground')}
                >
                  Super Admin always has every permission.
                </td>
                {list.map((role) => (
                  <td key={role.id} className="px-3 py-3 text-center">
                    {role.key === StaffRole.SUPER_ADMIN ? null : (
                      <Button
                        size="sm"
                        aria-label={`Save ${role.name}`}
                        disabled={!isChanged(role)}
                        onClick={() => (save.reset(), setSaving(role))}
                      >
                        Save
                      </Button>
                    )}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </Card>
      </QueryBoundary>
      <ReasonDialog
        open={saving !== null}
        onOpenChange={(open) => !open && setSaving(null)}
        title={`Save ${saving?.name ?? ''} permissions?`}
        confirmLabel="Save permissions"
        isPending={save.isPending}
        error={save.error}
        onConfirm={(reason) => saving && save.mutate({ role: saving, reason })}
      />
    </div>
  );
}
