import { type AdminMenu } from '@ennel/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/shared/api-client/api-error';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/shared/components/ui/dialog';
import { Checkbox } from '@/shared/components/ui/form-controls';
import { addDays, formatBusinessDate } from '@/shared/lib/format';
import { copyMenuWeek, publishMenu } from '../api/menus-api';

/** Admin §E copy-from-previous-week; copies arrive as drafts. */
export function CopyWeekDialog({
  weekStart,
  open,
  onOpenChange,
}: {
  weekStart: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [overwrite, setOverwrite] = useState(false);
  const previousWeek = addDays(weekStart, -7);
  const copy = useMutation({
    mutationFn: () => copyMenuWeek(previousWeek, weekStart, overwrite),
    onSuccess: ({ copied }) => {
      toast.success(`${copied} menus copied as drafts.`);
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: ['menus'] });
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Copy last week?"
        description={`Menus from the week of ${formatBusinessDate(previousWeek, 'd MMM')} are copied here as drafts.`}
      >
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={overwrite} onChange={(event) => setOverwrite(event.target.checked)} />{' '}
          Replace menus that already exist this week
        </label>
        {copy.error ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {errorMessage(copy.error)}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={copy.isPending} onClick={() => copy.mutate()}>
            Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Publishes the week's unpublished menus one at a time, through the same audited endpoint as a
 * single menu. It stops at the first failure: those already published stay published and the
 * dialog says how far it got.
 */
export function PublishWeekDialog({
  menus,
  open,
  onOpenChange,
}: {
  menus: AdminMenu[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [published, setPublished] = useState(0);
  const publish = useMutation({
    mutationFn: async () => {
      let notified = 0;
      setPublished(0);
      for (const [index, menu] of menus.entries()) {
        const result = await publishMenu(menu.id ?? '', menu.version ?? 1);
        notified += result.notifiedStudents;
        setPublished(index + 1);
      }
      return notified;
    },
    onSuccess: (notified) => {
      toast.success(
        notified > 0
          ? `Published ${menus.length} menus. ${notified} booked students were told the menu changed.`
          : `Published ${menus.length} menus.`,
      );
      onOpenChange(false);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['menus'] }),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Publish ${menus.length} menus?`}
        description="Students see these menus straight away. Students booked for a menu that changed after it was published are told."
      >
        {publish.error ? (
          <p role="alert" className="text-sm text-danger">
            {published > 0 ? `${published} published, then this stopped: ` : ''}
            {errorMessage(publish.error)}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={publish.isPending || menus.length === 0}
            onClick={() => publish.mutate()}
          >
            {publish.isPending ? 'Publishing…' : 'Publish & notify students'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
