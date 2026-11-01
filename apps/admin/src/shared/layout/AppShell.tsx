import { Menu } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router';
import { useAuth } from '@/features/auth/auth-context';
import { formatRoles } from '@/features/staff/constants/role-labels';
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

/**
 * Signed-in layout: permission-aware sidebar, top bar with the account menu. Below `lg` the
 * sidebar becomes a drawer opened from the top bar (Admin UX: responsive down to tablet).
 */
export function AppShell() {
  const { me, permissions, signOut } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const items = getVisibleNavItems(permissions);

  return (
    <div className="flex min-h-screen">
      <Sidebar items={items} className="hidden lg:block" />
      <DialogPrimitive.Root open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40 lg:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 overflow-y-auto shadow-lg focus:outline-none lg:hidden">
            <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Pages you can open
            </DialogPrimitive.Description>
            <Sidebar items={items} onNavigate={() => setIsMenuOpen(false)} className="min-h-full" />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-background px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open menu"
              onClick={() => setIsMenuOpen(true)}
            >
              <Menu aria-hidden />
            </Button>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Times shown in IST
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Account menu">
                {me?.fullName ?? 'Account'}
                <span className="hidden text-muted-foreground sm:inline">
                  {formatRoles(me?.roles ?? [])}
                </span>
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
        {/* The Figma canvas colour (`color/bg`) sits behind the white cards. */}
        <main className="flex-1 bg-surface p-4 sm:p-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
