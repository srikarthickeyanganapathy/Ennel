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
import { toast } from 'sonner';
import { usePermissions } from '@/features/auth/auth-context';
import {
  getPolicy,
  listPolicyHistory,
  updatePolicy,
} from '@/features/mess-config/api/mess-config-api';
import { isVersionConflict } from '@/shared/api-client/api-error';
import { QueryBoundary } from '@/shared/components/QueryStates';
import { ReasonDialog } from '@/shared/components/ReasonDialog';
import { Button } from '@/shared/components/ui/button';
import { Card, CardHeader } from '@/shared/components/ui/card';
import { Checkbox, Field, Input, Select } from '@/shared/components/ui/form-controls';
import { PageHeader } from '@/shared/layout/PageHeader';
import { formatDateTime } from '@/shared/lib/format';

type Draft = Pick<MessPolicyView, PolicyField>;

const NUMBER_FIELDS: { key: keyof Draft; label: string; suffix: string }[] = [
  {
    key: 'cancellationCutoffMinutes',
    label: 'Cancellation closes',
    suffix: 'minutes before slot start',
  },
  {
    key: 'dietTypeChangeCutoffMinutes',
    label: 'Veg/Non-Veg change closes',
    suffix: 'minutes before slot start',
  },
  { key: 'bookingHorizonDays', label: 'Booking horizon', suffix: 'days ahead' },
  { key: 'noShowWindowDays', label: 'No-show window', suffix: 'days' },
  { key: 'noShowWarningThreshold', label: 'No-show warning at', suffix: 'No-shows' },
  { key: 'noShowDisableThreshold', label: 'Default Booking off at', suffix: 'No-shows' },
  { key: 'forecastLookbackDays', label: 'Forecast history', suffix: 'days' },
];
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

/** Rule 8 policy settings with explanations, a mandatory reason and change history (Admin §D). */
export function PolicyPage() {
  const queryClient = useQueryClient();
  const canEdit = usePermissions()('policy:update');
  const policy = useQuery({ queryKey: ['policy'], queryFn: getPolicy });
  const history = useQuery({ queryKey: ['policy-history'], queryFn: () => listPolicyHistory(1) });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => {
    if (policy.data) setDraft(toDraft(policy.data));
  }, [policy.data]);

  const changes = changedFields(draft, policy.data);
  const changeCount = Object.keys(changes).length;
  // An emptied number input is NaN; it must be filled in before saving.
  const hasEmptyNumber = NUMBER_FIELDS.some((field) => Number.isNaN(draft?.[field.key]));
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
      toast.success('Policy saved.');
      setIsSaving(false);
    },
    // Reload so the page shows the colleague's version; the form resets to it.
    onError: (error) => {
      if (isVersionConflict(error)) void queryClient.invalidateQueries({ queryKey: ['policy'] });
    },
  });
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  const saveButton = (
    <Button
      disabled={changeCount === 0 || hasEmptyNumber}
      title={changeCount === 0 ? 'Nothing has changed yet' : undefined}
      onClick={() => (save.reset(), setIsSaving(true))}
    >
      {changeCount > 0
        ? `Save ${changeCount} ${changeCount === 1 ? 'change' : 'changes'}`
        : 'Save changes'}
    </Button>
  );

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Policy settings"
        breadcrumbs={[{ label: 'Policy' }]}
        description={
          policy.data
            ? `Version ${policy.data.version} · last changed ${formatDateTime(policy.data.updatedAt)}${policy.data.updatedByName ? ` by ${policy.data.updatedByName}` : ''}`
            : undefined
        }
        actions={canEdit ? saveButton : null}
      />
      <QueryBoundary
        isLoading={policy.isLoading || !draft}
        error={policy.error}
        onRetry={() => void policy.refetch()}
      >
        {draft ? (
          <>
            <Card>
              <CardHeader title="Booking and leave" />
              <div className="space-y-4">
                <label className="flex items-start gap-3">
                  <Checkbox
                    className="mt-1"
                    disabled={!canEdit}
                    checked={draft.allowOverCapacityBooking}
                    onChange={(event) => set('allowOverCapacityBooking', event.target.checked)}
                  />
                  <span>
                    <span className="font-medium">Allow bookings above official capacity</span>
                    <span className="block text-sm text-muted-foreground">
                      {POLICY_DESCRIPTIONS.allowOverCapacityBooking}
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3">
                  <Checkbox
                    className="mt-1"
                    disabled={!canEdit}
                    checked={draft.leaveRequiresApproval}
                    onChange={(event) => set('leaveRequiresApproval', event.target.checked)}
                  />
                  <span>
                    <span className="font-medium">Leave requires staff approval</span>
                    <span className="block text-sm text-muted-foreground">
                      {POLICY_DESCRIPTIONS.leaveRequiresApproval}
                    </span>
                  </span>
                </label>
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
                <Field
                  label="Complaint privacy"
                  htmlFor="privacy"
                  hint={POLICY_DESCRIPTIONS.complaintPrivacyMode}
                >
                  <Select
                    id="privacy"
                    disabled={!canEdit}
                    value={draft.complaintPrivacyMode}
                    onChange={(event) =>
                      set(
                        'complaintPrivacyMode',
                        event.target.value as Draft['complaintPrivacyMode'],
                      )
                    }
                  >
                    <option value={ComplaintPrivacyMode.PRIVATE_IDENTIFIED}>
                      Private, identified to authorized staff
                    </option>
                    <option value={ComplaintPrivacyMode.ANONYMOUS}>Fully anonymous</option>
                  </Select>
                </Field>
              </div>
            </Card>
            <Card>
              <CardHeader title="Deadlines, horizon and No-shows" />
              <div className="grid gap-4 sm:grid-cols-2">
                {NUMBER_FIELDS.map((field) => (
                  <Field
                    key={field.key}
                    label={`${field.label} (${field.suffix})`}
                    htmlFor={field.key}
                    hint={POLICY_DESCRIPTIONS[field.key]}
                  >
                    <Input
                      id={field.key}
                      type="number"
                      disabled={!canEdit}
                      value={Number.isNaN(draft[field.key]) ? '' : String(draft[field.key])}
                      onChange={(event) => set(field.key, event.target.valueAsNumber as never)}
                    />
                  </Field>
                ))}
              </div>
            </Card>
            <Card>
              <CardHeader
                title="College-controlled profile fields"
                description={POLICY_DESCRIPTIONS.collegeControlledFields}
              />
              <div className="grid gap-2 sm:grid-cols-4">
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
            </Card>
          </>
        ) : null}
      </QueryBoundary>
      <Card>
        <CardHeader title="Change history" />
        <QueryBoundary isLoading={history.isLoading} error={history.error}>
          <ul className="divide-y divide-border text-sm">
            {(history.data?.items ?? []).map((item) => (
              <li key={item.id} className="py-2">
                <p className="font-medium">
                  Version {item.version} · {formatDateTime(item.createdAt)} · {item.changedByName}
                </p>
                <p className="text-muted-foreground">{item.reason}</p>
                <ul className="mt-1 text-xs">
                  {Object.keys(item.after).map((key) => (
                    <li key={key}>
                      {key}: {JSON.stringify(item.before[key])} → {JSON.stringify(item.after[key])}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {history.data?.items.length === 0 ? (
              <li className="py-2 text-muted-foreground">No changes yet.</li>
            ) : null}
          </ul>
        </QueryBoundary>
      </Card>
      <ReasonDialog
        open={isSaving}
        onOpenChange={setIsSaving}
        title="Save policy changes?"
        description="Changes apply immediately to students and staff."
        confirmLabel="Save policy"
        isPending={save.isPending}
        error={save.error}
        onConfirm={(reason) => save.mutate(reason)}
      />
    </div>
  );
}
