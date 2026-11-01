import { type PendingWork, type PermissionKey } from '@ennel/shared';
import {
  Briefcase,
  ChevronRight,
  MessageSquare,
  ScanFace,
  ScanLine,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router';
import { usePermissions } from '@/features/auth/auth-context';
import { StatusBadge, type StatusTone } from '@/shared/components/StatusBadge';
import { Card } from '@/shared/components/ui/card';

interface Row {
  key: keyof PendingWork;
  label: string;
  icon: LucideIcon;
  path: string;
  permission: PermissionKey;
  tone: StatusTone;
}

const ROWS: Row[] = [
  {
    key: 'leaveApprovals',
    label: 'Leave requests to review',
    icon: Briefcase,
    path: '/leaves',
    permission: 'leaves:read',
    tone: 'info',
  },
  {
    key: 'openComplaints',
    label: 'Open complaints',
    icon: MessageSquare,
    path: '/complaints',
    permission: 'complaints:read',
    tone: 'warning',
  },
  {
    key: 'noShowAppeals',
    label: 'No-show appeals',
    icon: ScanFace,
    path: '/no-shows',
    permission: 'no-shows:read',
    tone: 'warning',
  },
  // No-shows held while outage mode was on (BR-NS-7).
  {
    key: 'attendanceIssues',
    label: 'No-shows held for review',
    icon: ScanLine,
    path: '/no-shows',
    permission: 'no-shows:read',
    tone: 'danger',
  },
];

/** Admin §C pending-work cards, shaped like the Figma "Needs action" list. */
export function NeedsActionCard({ pending }: { pending: PendingWork }) {
  const can = usePermissions();
  return (
    <Card className="flex flex-col gap-1 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] sm:p-5">
      <h2 className="mb-1 text-base font-semibold">Needs action</h2>
      <ul>
        {ROWS.map((row) => {
          const count = pending[row.key];
          const content = (
            <>
              <row.icon aria-hidden className="size-[18px] shrink-0 text-muted-foreground" />
              <span className="flex-1 text-sm font-medium">{row.label}</span>
              {/* The count is also in words, never colour alone (Admin UX standards). */}
              <StatusBadge label={String(count)} tone={count > 0 ? row.tone : 'neutral'} />
            </>
          );
          return (
            <li key={row.key} className="border-t border-border first:border-t-0 sm:first:border-t">
              {can(row.permission) ? (
                <Link
                  to={row.path}
                  aria-label={`${row.label}: ${count}`}
                  className="flex min-h-11 items-center gap-3 py-2.5 hover:text-primary"
                >
                  {content}
                  <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
                </Link>
              ) : (
                <div className="flex min-h-11 items-center gap-3 py-2.5">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
