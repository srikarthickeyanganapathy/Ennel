import { toBusinessDate } from '@ennel/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { usePermissions } from '@/features/auth/auth-context';
import { listAnnouncements } from '@/features/announcements/api/announcements-api';
import { describeAudience } from '@/features/announcements/components/announcement-labels';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { formatTime } from '@/shared/lib/format';

/**
 * Figma "Announcements today": the latest sent announcements on the chosen date. The design's
 * "% read" has no data yet, so each row shows how many students received it in the app.
 */
export function AnnouncementsTodayCard({ date }: { date: string }) {
  const can = usePermissions();
  const sent = useQuery({
    queryKey: ['admin-announcements', 'dashboard'],
    queryFn: () => listAnnouncements({ status: 'SENT', page: 1, pageSize: 10 }),
    enabled: can('announcements:read'),
  });
  if (!can('announcements:read')) return null;
  const onDate = (sent.data?.items ?? [])
    .filter((item) => item.sentAt && toBusinessDate(new Date(item.sentAt)) === date)
    .slice(0, 3);
  return (
    <Card className="flex flex-col gap-3 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Announcements today</h2>
        <PermissionGate permissions={['announcements:manage']}>
          <Link to="/announcements" className="text-sm font-semibold text-primary hover:underline">
            New
          </Link>
        </PermissionGate>
      </div>
      {sent.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {!sent.isLoading && onDate.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing sent on this date.</p>
      ) : null}
      <ul>
        {onDate.map((item) => (
          <li key={item.id} className="flex flex-col gap-0.5 border-t border-border py-2.5">
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="line-clamp-2 text-[13px] text-muted-foreground">{item.body}</p>
            <p className="text-xs text-muted-foreground">
              {item.sentAt ? formatTime(item.sentAt) : ''} · {describeAudience(item.audience)} ·{' '}
              {item.deliveries.inApp} received
            </p>
          </li>
        ))}
      </ul>
      <PermissionGate permissions={['announcements:manage']}>
        <Button
          variant="outline"
          asChild
          className="min-h-12 w-full border-[1.5px] border-primary text-primary"
        >
          <Link to="/announcements">Compose announcement</Link>
        </Button>
      </PermissionGate>
    </Card>
  );
}
