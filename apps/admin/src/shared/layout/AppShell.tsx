import { Link, Outlet, useNavigate } from 'react-router';
import { useAuth } from '@/features/auth/auth-context';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { getVisibleNavItems } from './nav-items';
import { Sidebar } from './Sidebar';

/** Signed-in layout: permission-aware sidebar, top bar with the account menu. */
export function AppShell() {
  const { me, permissions, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen">
      <Sidebar items={getVisibleNavItems(permissions)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-4 border-b border-border px-6">
          <span className="text-sm text-muted-foreground">Times shown in IST</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Account menu">
                {me?.fullName ?? 'Account'}
                <span className="text-muted-foreground">{me?.roles.join(', ')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem asChild>
                <Link to="/account">Account and security</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void signOut().then(() => navigate('/login'))}>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
