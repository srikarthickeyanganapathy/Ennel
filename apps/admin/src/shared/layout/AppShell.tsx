import { PERMISSION_KEYS, type PermissionKey } from '@ennel/shared';
import { Outlet } from 'react-router';
import { getVisibleNavItems } from './nav-items';
import { Sidebar } from './Sidebar';

// Placeholder until Phase 2 loads the signed-in staff member's permissions from /admin/auth/me.
const PREVIEW_PERMISSIONS: ReadonlySet<PermissionKey> = new Set(PERMISSION_KEYS);

export function AppShell() {
  return (
    <div className="flex min-h-screen">
      <Sidebar items={getVisibleNavItems(PREVIEW_PERMISSIONS)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-border px-6">
          <span className="text-sm text-muted-foreground">Times shown in IST</span>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
