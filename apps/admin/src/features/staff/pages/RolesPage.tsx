import {
  PERMISSION_DESCRIPTIONS,
  PERMISSION_KEYS,
  type PermissionKey,
  type Role,
  StaffRole,
} from '@ennel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { QueryBoundary } from '@/shared/components/QueryStates';
import { ReasonDialog } from '@/shared/components/ReasonDialog';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/form-controls';
import { PageHeader } from '@/shared/layout/PageHeader';
import { listRoles, updateRolePermissions } from '../api/staff-api';

/** Role → permission matrix (Admin §A); only Super Admins (roles:manage) can change it. */
export function RolesPage() {
  const queryClient = useQueryClient();
  const roles = useQuery({ queryKey: ['roles'], queryFn: listRoles });
  const [draft, setDraft] = useState<Record<string, Set<PermissionKey>>>({});
  const [saving, setSaving] = useState<Role | null>(null);

  useEffect(() => {
    if (roles.data)
      setDraft(Object.fromEntries(roles.data.map((role) => [role.id, new Set(role.permissions)])));
  }, [roles.data]);

  const save = useMutation({
    mutationFn: ({ role, reason }: { role: Role; reason: string }) =>
      updateRolePermissions(role.id, [...(draft[role.id] ?? [])], reason),
    onSuccess: (role) => {
      toast.success(`${role.name} permissions saved.`);
      setSaving(null);
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
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">Permissions by role</caption>
            <thead className="bg-surface">
              <tr>
                <th scope="col" className="px-3 py-2 text-left">
                  Permission
                </th>
                {(roles.data ?? []).map((role) => (
                  <th key={role.id} scope="col" className="px-3 py-2 text-center">
                    {role.name}
                    <div className="text-xs font-normal text-muted-foreground">
                      {role.staffCount} staff
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_KEYS.map((key) => (
                <tr key={key} className="border-t border-border">
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    <code className="text-xs">{key}</code>
                    <div className="text-xs text-muted-foreground">
                      {PERMISSION_DESCRIPTIONS[key]}
                    </div>
                  </th>
                  {(roles.data ?? []).map((role) => (
                    <td key={role.id} className="px-3 py-2 text-center">
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
            </tbody>
            <tfoot>
              <tr className="border-t border-border">
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  Super Admin always has every permission.
                </td>
                {(roles.data ?? []).map((role) => (
                  <td key={role.id} className="px-3 py-2 text-center">
                    {role.key === StaffRole.SUPER_ADMIN ? null : (
                      <Button size="sm" disabled={!isChanged(role)} onClick={() => setSaving(role)}>
                        Save
                      </Button>
                    )}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
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
