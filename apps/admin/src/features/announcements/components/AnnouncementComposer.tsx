import {
  type Announcement,
  ANNOUNCEMENT_CATEGORIES,
  type AnnouncementAudience,
  createAnnouncementRequestSchema,
  type CreateAnnouncementRequest,
} from '@ennel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/shared/api-client/api-error';
import { ChoiceChip } from '@/shared/components/ChoiceChip';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogFooter } from '@/shared/components/ui/dialog';
import { Checkbox, Field, Input, Label, Textarea } from '@/shared/components/ui/form-controls';
import { listHostels } from '@/features/students/api/students-api';
import {
  createAnnouncement,
  previewAudience,
  scheduleAnnouncement,
  sendAnnouncement,
  updateAnnouncement,
} from '../api/announcements-api';
import { CATEGORY_NAMES, istInputToIso } from './announcement-labels';

type Category = (typeof ANNOUNCEMENT_CATEGORIES)[number];
type AudienceType = AnnouncementAudience['type'];
const YEARS = [1, 2, 3, 4, 5];
const BODY_MAX = 4000;

export interface ComposerDraft {
  title: string;
  body: string;
  category: Category;
  audienceType: AudienceType;
  hostelIds: string[];
  blockIds: string[];
  academicYears: number[];
  referenceText: string;
  hasPush: boolean;
  when: 'now' | 'schedule';
  scheduleAt: string;
}

export function draftFrom(announcement: Announcement | null): ComposerDraft {
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
    when: announcement?.status === 'SCHEDULED' ? 'schedule' : 'now',
    scheduleAt: '',
  };
}

function audienceOf(draft: ComposerDraft): AnnouncementAudience {
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

interface ComposerProps {
  /** A draft or scheduled announcement being edited; null composes a new one. */
  editing: Announcement | null;
  onDraftChange: (draft: ComposerDraft) => void;
  onDone: () => void;
}

/**
 * Figma "New announcement" composer (Admin §M). The design's priority chips are the announcement
 * categories (Urgent is one); "sound + banner" is not built, so it is not promised here.
 */
export function AnnouncementComposer({ editing, onDraftChange, onDone }: ComposerProps) {
  const id = useId();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(() => draftFrom(editing));
  const [problem, setProblem] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const set = <K extends keyof ComposerDraft>(key: K, value: ComposerDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  useEffect(() => onDraftChange(draft), [draft, onDraftChange]);
  const reach = useReach(audienceOf(draft));

  const save = (body: CreateAnnouncementRequest) =>
    editing
      ? updateAnnouncement(editing.id, { ...body, version: editing.version })
      : createAnnouncement(body);
  const submit = useMutation({
    mutationFn: async ({
      body,
      then,
    }: {
      body: CreateAnnouncementRequest;
      then: 'draft' | 'send' | 'schedule';
    }) => {
      const saved = await save(body);
      if (then === 'send') return { then, result: await sendAnnouncement(saved.id, saved.version) };
      if (then === 'schedule')
        return {
          then,
          result: await scheduleAnnouncement(
            saved.id,
            istInputToIso(draft.scheduleAt),
            saved.version,
          ),
        };
      return { then, result: saved };
    },
    onSuccess: ({ then }) => {
      toast.success(
        then === 'send'
          ? 'Announcement sent.'
          : then === 'schedule'
            ? 'Announcement scheduled.'
            : 'Draft saved.',
      );
      void queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      setIsConfirming(false);
      setDraft(draftFrom(null));
      onDone();
    },
  });

  const parsed = () => {
    const result = createAnnouncementRequestSchema.safeParse({
      title: draft.title,
      body: draft.body,
      category: draft.category,
      audience: audienceOf(draft),
      channels: draft.hasPush ? ['IN_APP', 'PUSH'] : ['IN_APP'],
    });
    setProblem(result.success ? null : (result.error.issues[0]?.message ?? 'Check the form'));
    return result.success ? result.data : null;
  };
  const onPrimary = () => {
    const body = parsed();
    if (!body) return;
    if (draft.when === 'schedule') {
      if (!draft.scheduleAt) return setProblem('Choose when to send it');
      return submit.mutate({ body, then: 'schedule' });
    }
    setIsConfirming(true);
  };

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {editing ? 'Edit announcement' : 'New announcement'}
        </h2>
        {editing ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(draftFrom(null));
              onDone();
            }}
          >
            Stop editing
          </Button>
        ) : null}
      </div>
      <Field label="Title" htmlFor={`${id}-title`}>
        <Input
          id={`${id}-title`}
          className="h-12 border-2 focus-visible:border-primary"
          maxLength={120}
          value={draft.title}
          onChange={(event) => set('title', event.target.value)}
        />
      </Field>
      <Field label="Message" htmlFor={`${id}-body`} hint={`${draft.body.length} / ${BODY_MAX}`}>
        <Textarea
          id={`${id}-body`}
          rows={3}
          maxLength={BODY_MAX}
          value={draft.body}
          onChange={(event) => set('body', event.target.value)}
        />
      </Field>
      <AudiencePicker draft={draft} set={set} />
      <ChipGroup label="Category">
        {ANNOUNCEMENT_CATEGORIES.map((category) => (
          <ChoiceChip
            key={category}
            label={CATEGORY_NAMES[category]}
            isSelected={draft.category === category}
            onClick={() => set('category', category)}
          />
        ))}
      </ChipGroup>
      <ChipGroup label="When">
        <ChoiceChip
          label="Send now"
          isSelected={draft.when === 'now'}
          onClick={() => set('when', 'now')}
        />
        <ChoiceChip
          label="Schedule"
          isSelected={draft.when === 'schedule'}
          onClick={() => set('when', 'schedule')}
        />
      </ChipGroup>
      {draft.when === 'schedule' ? (
        <Field label="Send at (IST)" htmlFor={`${id}-at`} hint="At least a minute from now.">
          <Input
            id={`${id}-at`}
            type="datetime-local"
            className="max-w-64"
            value={draft.scheduleAt}
            onChange={(event) => set('scheduleAt', event.target.value)}
          />
        </Field>
      ) : null}
      <Label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={draft.hasPush}
          onChange={(event) => set('hasPush', event.target.checked)}
        />
        Also send a push to phones (the lock screen only says “You have a new notice”)
      </Label>
      {problem ? <p className="text-sm text-destructive">{problem}</p> : null}
      {submit.error ? (
        <p className="text-sm text-destructive">{errorMessage(submit.error)}</p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <p role="status" className="text-[13px] text-muted-foreground sm:mr-auto">
          {reach.text}
        </p>
        <Button
          variant="ghost"
          className="min-h-12 text-primary"
          disabled={submit.isPending}
          onClick={() => {
            const body = parsed();
            if (body) submit.mutate({ body, then: 'draft' });
          }}
        >
          {editing ? 'Save changes' : 'Save draft'}
        </Button>
        <Button className="min-h-12" disabled={submit.isPending} onClick={onPrimary}>
          {draft.when === 'schedule' ? 'Schedule' : 'Publish now'}
        </Button>
      </div>
      {isConfirming ? (
        <Dialog open onOpenChange={(isOpen) => (isOpen ? undefined : setIsConfirming(false))}>
          <DialogContent
            title="Send this announcement now?"
            description={`“${draft.title.trim()}” goes to ${reach.count ?? 'the chosen'} student(s) in the app straight away. This cannot be undone.`}
          >
            {submit.error ? (
              <p className="text-sm text-destructive">{errorMessage(submit.error)}</p>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsConfirming(false)}>
                Back
              </Button>
              <Button
                disabled={submit.isPending}
                onClick={() => {
                  const body = parsed();
                  if (body) submit.mutate({ body, then: 'send' });
                }}
              >
                {submit.isPending ? 'Sending…' : 'Send now'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </Card>
  );
}

function ChipGroup({
  label,
  children,
  isMulti = false,
}: {
  label: string;
  children: React.ReactNode;
  isMulti?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <div
        role={isMulti ? 'group' : 'radiogroup'}
        aria-label={label}
        className="flex flex-wrap gap-2"
      >
        {children}
      </div>
    </div>
  );
}

/** Figma audience chips: everyone, one chip per hostel, or a block / year / custom list. */
function AudiencePicker({
  draft,
  set,
}: {
  draft: ComposerDraft;
  set: <K extends keyof ComposerDraft>(key: K, value: ComposerDraft[K]) => void;
}) {
  const id = useId();
  const hostels = useQuery({ queryKey: ['hostels'], queryFn: listHostels });
  const toggleHostel = (hostelId: string) => {
    const next = toggle(draft.audienceType === 'HOSTEL' ? draft.hostelIds : [], hostelId);
    set('hostelIds', next);
    set('audienceType', next.length > 0 ? 'HOSTEL' : 'ALL');
  };
  return (
    <div className="flex flex-col gap-2">
      <ChipGroup label="Audience" isMulti>
        <ChoiceChip
          role="checkbox"
          label="All students"
          isSelected={draft.audienceType === 'ALL'}
          onClick={() => set('audienceType', 'ALL')}
        />
        {(hostels.data ?? []).map((hostel) => (
          <ChoiceChip
            key={hostel.id}
            role="checkbox"
            label={hostel.name}
            isSelected={draft.audienceType === 'HOSTEL' && draft.hostelIds.includes(hostel.id)}
            onClick={() => toggleHostel(hostel.id)}
          />
        ))}
        <ChoiceChip
          role="checkbox"
          label="By block"
          isSelected={draft.audienceType === 'BLOCK'}
          onClick={() => set('audienceType', 'BLOCK')}
        />
        <ChoiceChip
          role="checkbox"
          label="By year"
          isSelected={draft.audienceType === 'ACADEMIC_YEAR'}
          onClick={() => set('audienceType', 'ACADEMIC_YEAR')}
        />
        <ChoiceChip
          role="checkbox"
          label="Custom list"
          isSelected={draft.audienceType === 'CUSTOM'}
          onClick={() => set('audienceType', 'CUSTOM')}
        />
      </ChipGroup>
      {draft.audienceType === 'BLOCK' ? (
        <div role="group" aria-label="Blocks" className="flex flex-wrap gap-2">
          {(hostels.data ?? []).flatMap((hostel) =>
            hostel.blocks.map((block) => (
              <ChoiceChip
                key={block.id}
                role="checkbox"
                label={`${hostel.name} • ${block.name}`}
                isSelected={draft.blockIds.includes(block.id)}
                onClick={() => set('blockIds', toggle(draft.blockIds, block.id))}
              />
            )),
          )}
        </div>
      ) : null}
      {draft.audienceType === 'ACADEMIC_YEAR' ? (
        <div role="group" aria-label="Academic years" className="flex flex-wrap gap-2">
          {YEARS.map((year) => (
            <ChoiceChip
              key={year}
              role="checkbox"
              label={`Year ${year}`}
              isSelected={draft.academicYears.includes(year)}
              onClick={() => set('academicYears', toggle(draft.academicYears, year))}
            />
          ))}
        </div>
      ) : null}
      {draft.audienceType === 'CUSTOM' ? (
        <Field
          label="Reference numbers"
          htmlFor={`${id}-refs`}
          hint="One per line, or separated by commas."
        >
          <Textarea
            id={`${id}-refs`}
            rows={3}
            value={draft.referenceText}
            onChange={(event) => set('referenceText', event.target.value)}
          />
        </Field>
      ) : null}
    </div>
  );
}

/** Figma "Reaches about N students": a debounced audience preview. */
function useReach(audience: AnnouncementAudience): { text: string; count: number | null } {
  const key = JSON.stringify(audience);
  const [settled, setSettled] = useState({ key, audience });
  useEffect(() => {
    const timer = setTimeout(() => setSettled({ key, audience }), 400);
    return () => clearTimeout(timer);
    // `key` captures every audience change; the object itself is new on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const preview = useQuery({
    queryKey: ['admin-announcements', 'reach', settled.key],
    queryFn: () => previewAudience(settled.audience),
    retry: false,
  });
  if (preview.error) return { text: errorMessage(preview.error), count: null };
  if (!preview.data) return { text: 'Counting recipients…', count: null };
  const unknown = preview.data.unknownReferenceNumbers;
  return {
    count: preview.data.recipients,
    text: `Reaches ${preview.data.recipients.toLocaleString('en-IN')} student(s)${unknown.length > 0 ? ` · not found: ${unknown.join(', ')}` : ''}`,
  };
}
