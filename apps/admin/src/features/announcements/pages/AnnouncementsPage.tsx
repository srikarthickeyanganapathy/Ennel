import { type Announcement } from '@ennel/shared';
import { useCallback, useState } from 'react';
import { usePermissions } from '@/features/auth/auth-context';
import { PageHeader } from '@/shared/layout/PageHeader';
import {
  type AnnouncementAction,
  AnnouncementActionDialog,
} from '../components/AnnouncementActionDialog';
import {
  AnnouncementComposer,
  type ComposerDraft,
  draftFrom,
} from '../components/AnnouncementComposer';
import { PendingAnnouncements, SentAnnouncements } from '../components/AnnouncementLists';
import { PhonePreview } from '../components/PhonePreview';

/**
 * Admin §M, built from the Figma "Admin — Announcements" frame: composer and lists on the left,
 * the phone preview on the right (below the composer on narrow screens).
 */
export function AnnouncementsPage() {
  const can = usePermissions();
  const canManage = can('announcements:manage');
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [draft, setDraft] = useState<ComposerDraft>(() => draftFrom(null));
  const [action, setAction] = useState<{
    kind: AnnouncementAction;
    announcement: Announcement;
  } | null>(null);
  const onDraftChange = useCallback((next: ComposerDraft) => setDraft(next), []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        breadcrumbs={[{ label: 'Announcements' }]}
        description="Students see announcements in the app; a push only tells them there is a new notice."
      />
      {/* Phones: composer, preview, lists. From `lg`: preview in its own column beside both. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
        {canManage ? (
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <AnnouncementComposer
              key={editing?.id ?? 'new'}
              editing={editing}
              onDraftChange={onDraftChange}
              onDone={() => setEditing(null)}
            />
          </div>
        ) : null}
        {canManage ? (
          <div className="lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
            <PhonePreview
              title={draft.title}
              body={draft.body}
              isUrgent={draft.category === 'URGENT'}
              hasPush={draft.hasPush}
            />
          </div>
        ) : null}
        <div className="flex min-w-0 flex-col gap-4 lg:col-start-1">
          <PendingAnnouncements
            onEdit={(announcement) => {
              setEditing(announcement);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onAction={(kind, announcement) => setAction({ kind, announcement })}
          />
          <SentAnnouncements />
        </div>
      </div>
      {action ? (
        <AnnouncementActionDialog
          key={`${action.kind}-${action.announcement.id}`}
          kind={action.kind}
          announcement={action.announcement}
          onClose={() => setAction(null)}
        />
      ) : null}
    </div>
  );
}
