import { type Announcement } from '@ennel/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { QueryBoundary } from '@/shared/components/QueryStates';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { formatDateTime } from '@/shared/lib/format';
import { listAnnouncements } from '../api/announcements-api';
import { type AnnouncementAction } from './AnnouncementActionDialog';
import { describeAudience, STATUS } from './announcement-labels';

const SENT_PAGE_SIZE = 10;

function ListCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-background">
      <h2 className="px-5 pb-3 pt-4 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Drafts and scheduled announcements, which can still be edited, sent or cancelled (Admin §M). */
export function PendingAnnouncements({
  onEdit,
  onAction,
}: {
  onEdit: (announcement: Announcement) => void;
  onAction: (kind: AnnouncementAction, announcement: Announcement) => void;
}) {
  const drafts = useQuery({
    queryKey: ['admin-announcements', 'pending', 'DRAFT'],
    queryFn: () => listAnnouncements({ status: 'DRAFT', page: 1, pageSize: 50 }),
  });
  const scheduled = useQuery({
    queryKey: ['admin-announcements', 'pending', 'SCHEDULED'],
    queryFn: () => listAnnouncements({ status: 'SCHEDULED', page: 1, pageSize: 50 }),
  });
  const items = [...(scheduled.data?.items ?? []), ...(drafts.data?.items ?? [])];
  if (!drafts.isLoading && !scheduled.isLoading && items.length === 0) return null;
  return (
    <ListCard title="Drafts and scheduled">
      <QueryBoundary
        isLoading={drafts.isLoading || scheduled.isLoading}
        error={drafts.error ?? scheduled.error}
        onRetry={() => void Promise.all([drafts.refetch(), scheduled.refetch()])}
      >
        <ul>
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 border-t border-border px-5 py-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className="truncate">{item.title}</span>
                  <StatusBadge {...STATUS[item.status]} />
                </p>
                <p className="text-xs text-muted-foreground">
                  {describeAudience(item.audience)} ·{' '}
                  {item.status === 'SCHEDULED' && item.scheduledFor
                    ? `Sends ${formatDateTime(item.scheduledFor)}`
                    : `Created ${formatDateTime(item.createdAt)} by ${item.createdByName}`}
                </p>
              </div>
              <PermissionGate permissions={['announcements:manage']}>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" onClick={() => onEdit(item)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onAction('schedule', item)}>
                    {item.status === 'SCHEDULED' ? 'Reschedule' : 'Schedule'}
                  </Button>
                  <Button size="sm" onClick={() => onAction('send', item)}>
                    Send now
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onAction('cancel', item)}>
                    Cancel
                  </Button>
                </div>
              </PermissionGate>
            </li>
          ))}
        </ul>
      </QueryBoundary>
    </ListCard>
  );
}

/**
 * Figma "Sent recently", with history paging. ENNEL does not track reads, so each row shows how
 * many students received it in the app and how the pushes went instead of a "% read" bar.
 */
export function SentAnnouncements() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'SENT' | 'CANCELLED'>('SENT');
  const sent = useQuery({
    queryKey: ['admin-announcements', 'history', status, page],
    queryFn: () => listAnnouncements({ status, page, pageSize: SENT_PAGE_SIZE }),
  });
  const pageCount = Math.max(1, Math.ceil((sent.data?.total ?? 0) / SENT_PAGE_SIZE));
  return (
    <ListCard title={status === 'SENT' ? 'Sent recently' : 'Cancelled'}>
      <div className="flex gap-2 px-5 pb-3 text-sm">
        {(['SENT', 'CANCELLED'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={status === option}
            onClick={() => {
              setStatus(option);
              setPage(1);
            }}
            className={
              status === option
                ? 'font-semibold text-primary underline underline-offset-4'
                : 'text-muted-foreground'
            }
          >
            {option === 'SENT' ? 'Sent' : 'Cancelled'}
          </button>
        ))}
      </div>
      <QueryBoundary
        isLoading={sent.isLoading}
        error={sent.error}
        onRetry={() => void sent.refetch()}
      >
        {sent.data?.items.length === 0 ? (
          <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
            Nothing here yet.
          </p>
        ) : null}
        <ul>
          {(sent.data?.items ?? []).map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-1 border-t border-border px-5 py-3 sm:flex-row sm:items-center sm:gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {describeAudience(item.audience)} ·{' '}
                  {formatDateTime(item.sentAt ?? item.createdAt)}
                </p>
              </div>
              <DeliverySummary announcement={item} />
            </li>
          ))}
        </ul>
        {pageCount > 1 ? (
          <div className="flex items-center justify-between border-t border-border px-5 py-2 text-xs text-muted-foreground">
            <Button
              size="sm"
              variant="ghost"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span>
              Page {page} of {pageCount}
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={page >= pageCount}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
      </QueryBoundary>
    </ListCard>
  );
}

function DeliverySummary({ announcement }: { announcement: Announcement }) {
  if (announcement.status === 'CANCELLED') return <StatusBadge {...STATUS.CANCELLED} />;
  const { inApp, pushSent, pushFailed } = announcement.deliveries;
  const hasPush = announcement.channels.includes('PUSH');
  return (
    <p className="text-xs font-semibold sm:text-right">
      {inApp} in the app
      {hasPush ? (
        <span className="block font-normal text-muted-foreground">
          {pushSent} push sent{pushFailed > 0 ? ` · ${pushFailed} not delivered` : ''}
        </span>
      ) : null}
    </p>
  );
}
