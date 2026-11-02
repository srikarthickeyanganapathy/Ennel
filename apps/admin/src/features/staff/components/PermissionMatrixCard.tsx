import { type PermissionKey, type Role } from '@ennel/shared';
import { Check, X } from 'lucide-react';
import { Link } from 'react-router';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/utils';

/** Plain-language rows for the design's matrix; each is worked out from real permission keys. */
const ROWS: { label: string; keys: PermissionKey[] }[] = [
  { label: 'See today’s live counts', keys: ['dashboard:read-today'] },
  { label: 'See student records', keys: ['students:read'] },
  { label: 'Mark attendance', keys: ['attendance:mark'] },
  { label: 'Edit menu & capacity', keys: ['menus:update', 'mess-config:update'] },
  { label: 'Approve leave', keys: ['leaves:approve'] },
  { label: 'Review No-show appeals', keys: ['no-shows:review-appeal'] },
  { label: 'Read complaints', keys: ['complaints:read'] },
  { label: 'Publish announcements', keys: ['announcements:manage'] },
  { label: 'Change rules & roles', keys: ['policy:update', 'roles:manage'] },
  { label: 'Export reports', keys: ['reports:export'] },
];
const HEAD = 'px-3 py-3 text-xs font-semibold whitespace-nowrap text-muted-foreground';

/** Figma "Permission matrix" (Admin §A): a read-only summary of what each role can do now. */
export function PermissionMatrixCard({ roles }: { roles: Role[] }) {
  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div>
          <h2 className="text-base font-semibold">Permission matrix</h2>
          <p className="text-xs text-muted-foreground">
            A summary of each role’s current permissions.
          </p>
        </div>
        <PermissionGate permissions={['roles:manage']}>
          <Button variant="outline" size="sm" asChild>
            <Link to="/staff/roles">Edit all permissions</Link>
          </Button>
        </PermissionGate>
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <caption className="sr-only">What each role can do</caption>
          <thead className="bg-neutral-surface">
            <tr>
              <th scope="col" className={cn(HEAD, 'pl-5 text-left')}>
                Permission
              </th>
              {roles.map((role) => (
                <th key={role.id} scope="col" className={cn(HEAD, 'w-32 text-center')}>
                  {role.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label} className="border-t border-border">
                <th scope="row" className="py-2.5 pr-3 pl-5 text-left text-[13px] font-normal">
                  {row.label}
                </th>
                {roles.map((role) => (
                  <td key={role.id} className="px-3 py-2.5 text-center">
                    <Allowed isAllowed={row.keys.every((key) => role.permissions.includes(key))} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Allowed({ isAllowed }: { isAllowed: boolean }) {
  const Icon = isAllowed ? Check : X;
  return (
    <span
      className={cn(
        'inline-flex size-5 items-center justify-center rounded-full',
        isAllowed ? 'bg-mint text-primary' : 'bg-neutral-surface text-muted-foreground',
      )}
    >
      <Icon aria-hidden className="size-3.5" strokeWidth={2.5} />
      <span className="sr-only">{isAllowed ? 'Yes' : 'No'}</span>
    </span>
  );
}
