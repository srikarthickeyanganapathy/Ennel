import {
  type Announcement,
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_CATEGORIES,
  type AnnouncementAudience,
  createAnnouncementRequestSchema,
} from '@ennel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/shared/api-client/api-error';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/shared/components/ui/dialog';
import {
  Checkbox,
  Field,
  Input,
  Label,
  Select,
  Textarea,
} from '@/shared/components/ui/form-controls';
import { listHostels } from '@/features/students/api/students-api';
import { createAnnouncement, previewAudience, updateAnnouncement } from '../api/announcements-api';
import { AUDIENCE_NAMES, CATEGORY_NAMES } from './announcement-labels';

type AudienceType = (typeof ANNOUNCEMENT_AUDIENCES)[number];
type Category = (typeof ANNOUNCEMENT_CATEGORIES)[number];

const YEARS = [1, 2, 3, 4, 5];

interface Draft {
  title: string;
  body: string;
  category: Category;
  audienceType: AudienceType;
  hostelIds: string[];
  blockIds: string[];
  academicYears: number[];
  referenceText: string;
  hasPush: boolean;
}

function toDraft(announcement: Announcement | null): Draft {
  return {
    title: announcement?.title ?? '',
    body: announcement?.body ?? '',
    category: announcement?.category ?? 'GENERAL',
    audienceType: announcement?.audience.type ?? 'ALL',
    hostelIds: announcement?.audience.hostelIds ?? [],
    blockIds: announcement?.audience.blockIds ?? [],
    academicYears: announcement?.audience.academicYears ?? [],
    referenceText: announcement?.audience.referenceNumbers.join('\n') ?? '',
    hasPush: announcement?.channels.includes('PUSH') ?? true,
  };
}

function toAudience(draft: Draft): AnnouncementAudience {
  return {
    type: draft.audienceType,
    hostelIds: draft.hostelIds,
    blockIds: draft.blockIds,
    academicYears: draft.academicYears,
    referenceNumbers: draft.referenceText
      .split(/[\s,;]+/)
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

const toggle = <T,>(list: T[], value: T) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

/** Admin §M compose and "edit before send". Saving keeps it a draft; sending is separate. */
export function ComposeAnnouncementDialog({
  announcement,
  onClose,
}: {
  announcement: Announcement | null;
  onClose: () => void;
}) {
  const id = useId();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(() => toDraft(announcement));
  const [problem, setProblem] = useState<string | null>(null);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const hostels = useQuery({ queryKey: ['hostels'], queryFn: listHostels });
  const preview = useMutation({ mutationFn: previewAudience });
  const save = useMutation({
    mutationFn: (body: Parameters<typeof createAnnouncement>[0]) =>
      announcement
        ? updateAnnouncement(announcement.id, { ...body, version: announcement.version })
        : createAnnouncement(body),
    onSuccess: () => {
      toast.success(announcement ? 'Announcement updated.' : 'Draft saved.');
      void queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      onClose();
    },
  });

  const parse = () => {
    const parsed = createAnnouncementRequestSchema.safeParse({
      title: draft.title,
      body: draft.body,
      category: draft.category,
      audience: toAudience(draft),
      channels: draft.hasPush ? ['IN_APP', 'PUSH'] : ['IN_APP'],
    });
    if (!parsed.success) setProblem(parsed.error.issues[0]?.message ?? 'Check the form');
    return parsed.success ? parsed.data : null;
  };
  const onSave = () => {
    const body = parse();
    if (!body) return;
    setProblem(null);
    save.mutate(body);
  };

  return (
    <Dialog open onOpenChange={(isOpen) => (isOpen ? undefined : onClose())}>
      <DialogContent
        title={announcement ? 'Edit announcement' : 'New announcement'}
        description="Saved as a draft. Send it now or schedule it from the list."
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <Field label="Title" htmlFor={`${id}-title`}>
            <Input
              id={`${id}-title`}
              value={draft.title}
              maxLength={120}
              onChange={(event) => set('title', event.target.value)}
            />
          </Field>
          <Field label="Message" htmlFor={`${id}-body`}>
            <Textarea
              id={`${id}-body`}
              rows={5}
              value={draft.body}
              maxLength={4000}
              onChange={(event) => set('body', event.target.value)}
            />
          </Field>
          <Field label="Category" htmlFor={`${id}-category`}>
            <Select
              id={`${id}-category`}
              value={draft.category}
              onChange={(event) => set('category', event.target.value as Category)}
            >
              {ANNOUNCEMENT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_NAMES[category]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Audience" htmlFor={`${id}-audience`}>
            <Select
              id={`${id}-audience`}
              value={draft.audienceType}
              onChange={(event) => {
                set('audienceType', event.target.value as AudienceType);
                preview.reset();
              }}
            >
              {ANNOUNCEMENT_AUDIENCES.map((type) => (
                <option key={type} value={type}>
                  {AUDIENCE_NAMES[type]}
                </option>
              ))}
            </Select>
          </Field>
          {draft.audienceType === 'HOSTEL' ? (
            <CheckList
              legend="Hostels"
              items={(hostels.data ?? []).map((hostel) => ({ id: hostel.id, label: hostel.name }))}
              selected={draft.hostelIds}
              onToggle={(value) => set('hostelIds', toggle(draft.hostelIds, value))}
            />
          ) : null}
          {draft.audienceType === 'BLOCK' ? (
            <CheckList
              legend="Blocks"
              items={(hostels.data ?? []).flatMap((hostel) =>
                hostel.blocks.map((block) => ({
                  id: block.id,
                  label: `${hostel.name} • ${block.name}`,
                })),
              )}
              selected={draft.blockIds}
              onToggle={(value) => set('blockIds', toggle(draft.blockIds, value))}
            />
          ) : null}
          {draft.audienceType === 'ACADEMIC_YEAR' ? (
            <CheckList
              legend="Academic years"
              items={YEARS.map((year) => ({ id: String(year), label: `Year ${year}` }))}
              selected={draft.academicYears.map(String)}
              onToggle={(value) => set('academicYears', toggle(draft.academicYears, Number(value)))}
            />
          ) : null}
          {draft.audienceType === 'CUSTOM' ? (
            <Field
              label="Reference numbers"
              htmlFor={`${id}-refs`}
              hint="One per line, or separated by commas."
            >
              <Textarea
                id={`${id}-refs`}
                rows={4}
                value={draft.referenceText}
                onChange={(event) => set('referenceText', event.target.value)}
              />
            </Field>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={preview.isPending}
              onClick={() => preview.mutate(toAudience(draft))}
            >
              {preview.isPending ? 'Counting…' : 'Count recipients'}
            </Button>
            {preview.data ? (
              <span className="text-sm" role="status">
                {preview.data.recipients} student(s) will receive this.
                {preview.data.unknownReferenceNumbers.length > 0
                  ? ` Not found: ${preview.data.unknownReferenceNumbers.join(', ')}.`
                  : ''}
              </span>
            ) : null}
            {preview.error ? (
              <span className="text-sm text-destructive">{errorMessage(preview.error)}</span>
            ) : null}
          </div>
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">Channels</legend>
            <Label className="flex items-center gap-2 text-sm">
              <Checkbox checked disabled /> In-app (always, holds the full message)
            </Label>
            <Label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={draft.hasPush}
                onChange={(event) => set('hasPush', event.target.checked)}
              />
              Push to phones (lock screen shows only “You have a new notice”)
            </Label>
          </fieldset>
          {problem ? <p className="text-sm text-destructive">{problem}</p> : null}
          {save.error ? (
            <p className="text-sm text-destructive">{errorMessage(save.error)}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : announcement ? 'Save changes' : 'Save draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CheckList({
  legend,
  items,
  selected,
  onToggle,
}: {
  legend: string;
  items: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <div className="grid max-h-40 gap-1 overflow-y-auto sm:grid-cols-2">
        {items.map((item) => (
          <Label key={item.id} className="flex items-center gap-2 text-sm">
            <Checkbox checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} />
            {item.label}
          </Label>
        ))}
      </div>
    </fieldset>
  );
}
