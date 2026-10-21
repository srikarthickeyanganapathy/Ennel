import { POLICY_DESCRIPTIONS } from '@ennel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { usePermissions } from '@/features/auth/auth-context';
import { isVersionConflict } from '@/shared/api-client/api-error';
import { QueryBoundary } from '@/shared/components/QueryStates';
import { ReasonDialog } from '@/shared/components/ReasonDialog';
import { Button } from '@/shared/components/ui/button';
import { Card, CardHeader } from '@/shared/components/ui/card';
import { Field, Input } from '@/shared/components/ui/form-controls';
import { getPolicy, updateThresholds } from '../api/mess-config-api';

/** Availability label thresholds (ADR-0013), edited with mess-config:update. */
export function ThresholdsCard() {
  const queryClient = useQueryClient();
  const can = usePermissions();
  // The values come from GET /policy (policy:read). Mess Staff hold mess-config:read without
  // policy:read, so querying anyway would put a permission error on their page.
  const canRead = can('policy:read');
  const canEdit = canRead && can('mess-config:update');
  const policy = useQuery({ queryKey: ['policy'], queryFn: getPolicy, enabled: canRead });
  const [values, setValues] = useState({ fillingFast: '', recommended: '' });
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => {
    if (policy.data) {
      setValues({
        fillingFast: String(policy.data.fillingFastThresholdPct),
        recommended: String(policy.data.recommendedMaxOccupancyPct),
      });
    }
  }, [policy.data]);

  const save = useMutation({
    mutationFn: (reason: string) =>
      updateThresholds({
        fillingFastThresholdPct: Number(values.fillingFast),
        recommendedMaxOccupancyPct: Number(values.recommended),
        reason,
        version: policy.data?.version ?? 1,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['policy'], updated);
      toast.success('Thresholds saved.');
      setIsSaving(false);
    },
    // The reloaded policy resets the inputs, so the next attempt starts from the latest values.
    onError: (error) => {
      if (isVersionConflict(error)) void queryClient.invalidateQueries({ queryKey: ['policy'] });
    },
  });

  if (!canRead) return null;
  return (
    <Card>
      <CardHeader
        title="Availability labels"
        description="When slots show Filling Fast and Recommended to students. Full and Over Capacity follow official capacity."
      />
      <QueryBoundary
        isLoading={policy.isLoading}
        error={policy.error}
        onRetry={() => void policy.refetch()}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Filling Fast at (% occupancy)"
            htmlFor="filling-fast"
            hint={POLICY_DESCRIPTIONS.fillingFastThresholdPct}
          >
            <Input
              id="filling-fast"
              type="number"
              min={1}
              max={99}
              disabled={!canEdit}
              value={values.fillingFast}
              onChange={(event) => setValues({ ...values, fillingFast: event.target.value })}
            />
          </Field>
          <Field
            label="Recommended up to (% occupancy)"
            htmlFor="recommended"
            hint={POLICY_DESCRIPTIONS.recommendedMaxOccupancyPct}
          >
            <Input
              id="recommended"
              type="number"
              min={1}
              max={99}
              disabled={!canEdit}
              value={values.recommended}
              onChange={(event) => setValues({ ...values, recommended: event.target.value })}
            />
          </Field>
        </div>
        {canEdit ? (
          <Button className="mt-4" onClick={() => (save.reset(), setIsSaving(true))}>
            Save thresholds
          </Button>
        ) : null}
      </QueryBoundary>
      <ReasonDialog
        open={isSaving}
        onOpenChange={setIsSaving}
        title="Save availability thresholds?"
        confirmLabel="Save"
        isPending={save.isPending}
        error={save.error}
        onConfirm={(reason) => save.mutate(reason)}
      />
    </Card>
  );
}
