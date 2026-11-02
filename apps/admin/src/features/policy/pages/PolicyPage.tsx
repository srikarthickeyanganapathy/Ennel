import {
  ComplaintPrivacyMode,
  type MessPolicyView,
  POLICY_DESCRIPTIONS,
  type PolicyField,
  SlotFullFallback,
  STUDENT_PROFILE_FIELDS,
  type UpdatePolicyRequest,
} from '@ennel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { usePermissions } from '@/features/auth/auth-context';
import { getPolicy, updatePolicy } from '@/features/mess-config/api/mess-config-api';
import { isVersionConflict } from '@/shared/api-client/api-error';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { QueryBoundary } from '@/shared/components/QueryStates';
import { ReasonDialog } from '@/shared/components/ReasonDialog';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Checkbox, Field, Select } from '@/shared/components/ui/form-controls';
import { PageHeader } from '@/shared/layout/PageHeader';
import { formatDateTime } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { PolicyChangeLog } from '../components/PolicyChangeLog';
import { RuleNumber, RuleRow, RuleSection, RuleSwitch } from '../components/RuleParts';
import {
  cancelSentence,
  dietSentence,
  disableSentence,
  forecastSentence,
  horizonSentence,
  warningSentence,
} from '../components/rule-sentences';

type Draft = Pick<MessPolicyView, PolicyField>;
type SetDraft = <K extends keyof Draft>(key: K, value: Draft[K]) => void;

const SECTIONS = [
  { id: 'deadlines', label: 'Deadlines' },
  { id: 'no-shows', label: 'No-show policy' },
  { id: 'booking', label: 'Default fallback' },
  { id: 'leave', label: 'Leave approval' },
  { id: 'privacy', label: 'Complaint privacy' },
  { id: 'profile', label: 'Profile fields' },
  { id: 'forecast', label: 'Forecast' },
  { id: 'change-log', label: 'Change log' },
];
const NUMBER_KEYS = [
  'cancellationCutoffMinutes',
  'dietTypeChangeCutoffMinutes',
  'bookingHorizonDays',
  'noShowWindowDays',
  'noShowWarningThreshold',
  'noShowDisableThreshold',
  'forecastLookbackDays',
] as const;
const FIELD_LABELS: Record<string, string> = {
  fullName: 'Full name',
  department: 'Department',
  academicYear: 'Academic year',
  hostelBlockId: 'Hostel block',
  roomNumber: 'Room',
  phone: 'Phone',
  parentPhone: "Parent's phone",
  email: 'Email',
};

function toDraft(policy: MessPolicyView): Draft {
  const {
    version: _version,
    updatedAt: _updatedAt,
    updatedByName: _by,
    fillingFastThresholdPct: _ff,
    recommendedMaxOccupancyPct: _rec,
    ...draft
  } = policy;
  return draft;
}

/** Only edited fields are sent, so an unchanged save cannot create an empty policy version. */
function changedFields(draft: Draft | null, policy: MessPolicyView | undefined): Partial<Draft> {
  if (!draft || !policy) return {};
  const original = toDraft(policy);
  return Object.fromEntries(
    Object.entries(draft).filter(
      ([key, value]) => JSON.stringify(value) !== JSON.stringify(original[key as keyof Draft]),
    ),
  ) as Partial<Draft>;
}

/**
 * Figma "Admin — Settings & rules": rule 8 policy with plain-word effects, a mandatory reason and
 * a change log (Admin §D). Only settings the server applies appear; see docs/architecture.md for
 * the design's rows that have no rule behind them.
 */
export function PolicyPage() {
  const queryClient = useQueryClient();
  const canEdit = usePermissions()('policy:update');
  const policy = useQuery({ queryKey: ['policy'], queryFn: getPolicy });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState(SECTIONS[0]?.id);
  useEffect(() => {
    if (policy.data) setDraft(toDraft(policy.data));
  }, [policy.data]);

  const changes = changedFields(draft, policy.data);
  const changeCount = Object.keys(changes).length;
  // An emptied number input is NaN; it must be filled in before saving.
  const hasEmptyNumber = NUMBER_KEYS.some((key) => Number.isNaN(draft?.[key]));
  const save = useMutation({
    mutationFn: (reason: string) =>
      updatePolicy({
        ...(changes as Omit<UpdatePolicyRequest, 'version' | 'reason'>),
        reason,
        version: policy.data?.version ?? 1,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['policy'], updated);
      void queryClient.invalidateQueries({ queryKey: ['policy-history'] });
      toast.success('Rules saved.');
      setIsSaving(false);
    },
    // Reload so the page shows the colleague's version; the form resets to it.
    onError: (error) => {
      if (isVersionConflict(error)) void queryClient.invalidateQueries({ queryKey: ['policy'] });
    },
  });
  const set: SetDraft = (key, value) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  const goTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView?.({ behavior: 'smooth' });
  };

  return (
    <div>
      <PageHeader
        title="Settings & rules"
        breadcrumbs={[{ label: 'Settings & rules' }]}
        description={
          policy.data
            ? `Version ${policy.data.version} · last changed ${formatDateTime(policy.data.updatedAt)}${policy.data.updatedByName ? ` by ${policy.data.updatedByName}` : ''}`
            : undefined
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <Card className="p-2 lg:sticky lg:top-4">
          <nav aria-label="Settings sections" className="flex gap-0.5 overflow-x-auto lg:flex-col">
            <PermissionGate permissions={['mess-config:read']}>
              <Link
                to="/mess-config"
                className="rounded-sm px-3 py-2.5 text-sm font-medium whitespace-nowrap hover:bg-mint/60"
              >
                Meal timetable
              </Link>
            </PermissionGate>
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                aria-current={activeSection === section.id ? 'true' : undefined}
                className={cn(
                  'rounded-sm px-3 py-2.5 text-left text-sm font-medium whitespace-nowrap',
                  activeSection === section.id
                    ? 'bg-mint font-semibold text-primary'
                    : 'hover:bg-mint/60',
                )}
                onClick={() => goTo(section.id)}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </Card>
        <div className="flex min-w-0 flex-col gap-4">
          <QueryBoundary
            isLoading={policy.isLoading || !draft}
            error={policy.error}
            onRetry={() => void policy.refetch()}
          >
            {draft ? <RuleCards draft={draft} canEdit={canEdit} set={set} /> : null}
          </QueryBoundary>
          <PolicyChangeLog />
          {canEdit ? (
            <div className="sticky bottom-0 flex justify-end gap-2 bg-surface py-3">
              <Button
                variant="ghost"
                className="h-12 font-semibold text-primary"
                disabled={changeCount === 0}
                onClick={() => policy.data && setDraft(toDraft(policy.data))}
              >
                Discard
              </Button>
              <Button
                className="h-12 font-semibold"
                disabled={changeCount === 0 || hasEmptyNumber}
                title={changeCount === 0 ? 'Nothing has changed yet' : undefined}
                onClick={() => (save.reset(), setIsSaving(true))}
              >
                {changeCount > 0
                  ? `Save ${changeCount} ${changeCount === 1 ? 'change' : 'changes'}`
                  : 'Save rules'}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      <ReasonDialog
        open={isSaving}
        onOpenChange={setIsSaving}
        title="Save rule changes?"
        description="Changes apply immediately to students and staff."
        confirmLabel="Save rules"
        isPending={save.isPending}
        error={save.error}
        onConfirm={(reason) => save.mutate(reason)}
      />
    </div>
  );
}

function RuleCards({ draft, canEdit, set }: { draft: Draft; canEdit: boolean; set: SetDraft }) {
  const number = (key: (typeof NUMBER_KEYS)[number], label?: string) => (
    <RuleNumber
      id={key}
      label={label}
      value={draft[key]}
      disabled={!canEdit}
      onChange={(value) => set(key, value)}
    />
  );
  return (
    <>
      <RuleSection id="deadlines" title="Deadlines" description="Applied by the server.">
        <RuleRow
          label="Cancel deadline"
          htmlFor="cancellationCutoffMinutes"
          sentence={cancelSentence(draft.cancellationCutoffMinutes)}
        >
          {number('cancellationCutoffMinutes')} minutes before slot
        </RuleRow>
        <RuleRow
          label="Veg/Non-Veg change deadline"
          htmlFor="dietTypeChangeCutoffMinutes"
          sentence={dietSentence(draft.dietTypeChangeCutoffMinutes)}
        >
          {number('dietTypeChangeCutoffMinutes')} minutes before slot
        </RuleRow>
        <RuleRow
          label="Booking horizon"
          htmlFor="bookingHorizonDays"
          sentence={horizonSentence(draft.bookingHorizonDays)}
        >
          {number('bookingHorizonDays')} days ahead
        </RuleRow>
      </RuleSection>
      <RuleSection id="no-shows" title="No-show policy">
        <RuleRow
          label="Default Booking turns off at"
          sentence={disableSentence(draft.noShowDisableThreshold, draft.noShowWindowDays)}
        >
          {number('noShowDisableThreshold', 'Default Booking turns off at (No-shows)')} in{' '}
          {number('noShowWindowDays', 'No-show window (days)')} days, per meal
        </RuleRow>
        <RuleRow
          label="Warning at"
          htmlFor="noShowWarningThreshold"
          sentence={warningSentence(draft.noShowWarningThreshold)}
        >
          {number('noShowWarningThreshold')}
        </RuleRow>
      </RuleSection>
      <RuleSection id="booking" title="Default fallback">
        <RuleSwitch
          label="Allow bookings above official capacity"
          description={POLICY_DESCRIPTIONS.allowOverCapacityBooking}
          isOn={draft.allowOverCapacityBooking}
          disabled={!canEdit}
          onToggle={() => set('allowOverCapacityBooking', !draft.allowOverCapacityBooking)}
        />
        <div className="py-3.5">
          <Field
            label="When a default slot is full"
            htmlFor="fallback"
            hint={POLICY_DESCRIPTIONS.defaultSlotFullFallback}
          >
            <Select
              id="fallback"
              disabled={!canEdit}
              value={draft.defaultSlotFullFallback}
              onChange={(event) =>
                set(
                  'defaultSlotFullFallback',
                  event.target.value as Draft['defaultSlotFullFallback'],
                )
              }
            >
              <option value={SlotFullFallback.ASK_STUDENT}>Ask the student to choose</option>
              <option value={SlotFullFallback.AUTO_NEXT_AVAILABLE}>
                Book the next available slot and tell them
              </option>
            </Select>
          </Field>
        </div>
      </RuleSection>
      <RuleSection id="leave" title="Leave approval">
        <RuleSwitch
          label="Leave requires staff approval"
          description={POLICY_DESCRIPTIONS.leaveRequiresApproval}
          isOn={draft.leaveRequiresApproval}
          disabled={!canEdit}
          onToggle={() => set('leaveRequiresApproval', !draft.leaveRequiresApproval)}
        />
      </RuleSection>
      <RuleSection id="privacy" title="Complaint privacy">
        <div className="py-3.5">
          <Field
            label="Who can see a complaint’s author"
            htmlFor="privacy-mode"
            hint={POLICY_DESCRIPTIONS.complaintPrivacyMode}
          >
            <Select
              id="privacy-mode"
              disabled={!canEdit}
              value={draft.complaintPrivacyMode}
              onChange={(event) =>
                set('complaintPrivacyMode', event.target.value as Draft['complaintPrivacyMode'])
              }
            >
              <option value={ComplaintPrivacyMode.PRIVATE_IDENTIFIED}>
                Private, identified to authorized staff
              </option>
              <option value={ComplaintPrivacyMode.ANONYMOUS}>Fully anonymous</option>
            </Select>
          </Field>
        </div>
      </RuleSection>
      <RuleSection
        id="profile"
        title="Profile fields"
        description={POLICY_DESCRIPTIONS.collegeControlledFields}
      >
        <div className="grid grid-cols-2 gap-2 py-3.5 sm:grid-cols-4">
          {STUDENT_PROFILE_FIELDS.map((field) => (
            <label key={field} className="flex items-center gap-2 text-sm">
              <Checkbox
                disabled={!canEdit}
                checked={draft.collegeControlledFields.includes(field)}
                onChange={(event) =>
                  set(
                    'collegeControlledFields',
                    event.target.checked
                      ? [...draft.collegeControlledFields, field]
                      : draft.collegeControlledFields.filter((item) => item !== field),
                  )
                }
              />
              {FIELD_LABELS[field]}
            </label>
          ))}
        </div>
      </RuleSection>
      <RuleSection id="forecast" title="Forecast">
        <RuleRow
          label="Forecast history"
          htmlFor="forecastLookbackDays"
          sentence={forecastSentence(draft.forecastLookbackDays)}
        >
          {number('forecastLookbackDays')} days
        </RuleRow>
      </RuleSection>
    </>
  );
}
