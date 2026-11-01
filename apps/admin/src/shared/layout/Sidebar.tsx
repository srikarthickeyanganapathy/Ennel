import { Utensils } from 'lucide-react';
import { NavLink } from 'react-router';
import { cn } from '@/shared/lib/utils';
import { type NavItem } from './nav-items';

interface SidebarProps {
  items: NavItem[];
  /** Called after a link is chosen, so the phone drawer can close. */
  onNavigate?: () => void;
  className?: string;
}

export function Sidebar({ items, onNavigate, className }: SidebarProps) {
  return (
    <nav
      aria-label="Main"
      className={cn('w-64 shrink-0 border-r border-border bg-background px-3 py-5', className)}
    >
      <div className="mb-4 flex items-center gap-2.5 pl-2">
        <span
          aria-hidden
          className="flex size-8 items-center justify-center rounded-sm bg-primary text-primary-foreground"
        >
          <Utensils className="size-[18px]" />
        </span>
        <span className="leading-tight">
          <span className="block text-lg font-bold text-primary">ENNEL</span>
          <span className="block text-[11px] font-medium text-muted-foreground">Mess Admin</span>
        </span>
      </div>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              end={item.path === '/'}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex min-h-10 items-center rounded-sm px-3 text-sm',
                  isActive
                    ? 'bg-mint font-semibold text-primary'
                    : 'font-medium text-foreground hover:bg-mint/60',
                )
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
