import { type Announcement } from '@ennel/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/shared/api-client/api-error';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/shared/components/ui/dialog';
import { Field, Input } from '@/shared/components/ui/form-controls';
import {
  cancelAnnouncement,
  scheduleAnnouncement,
  sendAnnouncement,
} from '../api/announcements-api';
import { istInputToIso } from './announcement-labels';

export type AnnouncementAction = 'send' | 'cancel' | 'schedule';

const TEXT = {
  send: {
    title: 'Send this announcement now?',
    description:
      'Every student in the audience gets it in the app straight away. This cannot be undone.',
    confirm: 'Send now',
    done: 'Announcement sent.',
  },
  cancel: {
    title: 'Cancel this announcement?',
    description: 'It will not be sent. It stays in the history as Cancelled.',
    confirm: 'Cancel announcement',
    done: 'Announcement cancelled.',
  },
  schedule: {
    title: 'Schedule this announcement',
    description: 'Times are India Standard Time (IST).',
    confirm: 'Schedule',
    done: 'Announcement scheduled.',
  },
} as const;

/** Confirmation for sending, cancelling or scheduling a saved announcement (Admin UX standards). */
export function AnnouncementActionDialog({
  kind,
  announcement,
  onClose,
}: {
  kind: AnnouncementAction;
  announcement: Announcement;
  onClose: () => void;
}) {
  const id = useId();
  const queryClient = useQueryClient();
  const [when, setWhen] = useState('');
  const text = TEXT[kind];
  const mutation = useMutation({
    mutationFn: () => {
      if (kind === 'send') return sendAnnouncement(announcement.id, announcement.version);
      if (kind === 'cancel') return cancelAnnouncement(announcement.id, announcement.version);
      return scheduleAnnouncement(announcement.id, istInputToIso(when), announcement.version);
    },
    onSuccess: () => {
      toast.success(text.done);
      void queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(isOpen) => (isOpen ? undefined : onClose())}>
      <DialogContent
        title={text.title}
        description={`“${announcement.title}”. ${text.description}`}
      >
        {kind === 'schedule' ? (
          <Field label="Send at (IST)" htmlFor={`${id}-when`}>
            <Input
              id={`${id}-when`}
              type="datetime-local"
              value={when}
              onChange={(event) => setWhen(event.target.value)}
            />
          </Field>
        ) : null}
        {mutation.error ? (
          <p className="mt-2 text-sm text-destructive">{errorMessage(mutation.error)}</p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Back
          </Button>
          <Button
            variant={kind === 'cancel' ? 'destructive' : 'default'}
            disabled={mutation.isPending || (kind === 'schedule' && !when)}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Working…' : text.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
