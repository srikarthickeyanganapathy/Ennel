import { NavLink } from 'react-router';
import { cn } from '@/shared/lib/utils';
import { type NavItem } from './nav-items';

interface SidebarProps {
  items: NavItem[];
}

export function Sidebar({ items }: SidebarProps) {
  return (
    <nav aria-label="Main" className="w-60 shrink-0 border-r border-border bg-surface p-4">
      <p className="mb-6 px-2 text-lg font-bold text-primary">ENNEL Admin</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                cn(
                  'block rounded-md px-2 py-1.5 text-sm',
                  isActive
                    ? 'bg-mint font-semibold text-primary'
                    : 'text-foreground hover:bg-mint/60',
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
