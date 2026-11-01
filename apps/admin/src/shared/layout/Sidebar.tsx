import { type PendingWork } from '@ennel/shared';
import { Utensils } from 'lucide-react';
import { NavLink } from 'react-router';
import { cn } from '@/shared/lib/utils';
import { type NavItem } from './nav-items';

interface SidebarProps {
  items: NavItem[];
  /** Counts for the badges; absent for roles without the dashboard. */
  pending?: PendingWork;
  /** Called after a link is chosen, so the phone drawer can close. */
  onNavigate?: () => void;
  className?: string;
}

const SECTIONS: { key: NavItem['section']; title: string | null }[] = [
  { key: 'main', title: null },
  { key: 'admin', title: 'Admin' },
];

/** Figma sidebar: brand mark, icon + label rows, an "Admin" group and pending-work badges. */
export function Sidebar({ items, pending, onNavigate, className }: SidebarProps) {
  return (
    <nav
      aria-label="Main"
      className={cn('w-64 shrink-0 border-r border-border bg-background px-3 py-5', className)}
    >
      <div className="flex items-center gap-2.5 pb-4 pl-2">
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
      {SECTIONS.map((section) => {
        const sectionItems = items.filter((item) => item.section === section.key);
        if (sectionItems.length === 0) return null;
        return (
          <div key={section.key}>
            {section.title ? (
              <p className="pb-1 pl-3 pt-3 text-[11px] font-semibold uppercase text-muted-foreground">
                {section.title}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {sectionItems.map((item) => (
                <li key={item.path}>
                  <NavRow
                    item={item}
                    count={pending && item.badge ? item.badge(pending) : 0}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function NavRow({
  item,
  count,
  onNavigate,
}: {
  item: NavItem;
  count: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      onClick={onNavigate}
      aria-label={count > 0 ? `${item.label}, ${count} waiting` : undefined}
      className={({ isActive }) =>
        cn(
          'flex min-h-10 items-center gap-3 rounded-sm px-3 text-sm',
          isActive
            ? 'bg-mint font-semibold text-primary'
            : 'font-medium text-foreground hover:bg-mint/60',
        )
      }
    >
      <Icon className="size-[18px] shrink-0" />
      <span className="flex-1">{item.label}</span>
      {count > 0 ? (
        <span
          aria-hidden
          className="rounded-full bg-danger-surface px-[7px] py-px text-[11px] font-semibold text-danger"
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </NavLink>
  );
}
