import {
  CLOSURE_KINDS,
  type ClosureImpact,
  type ClosureKind,
  type CreateClosureRequest,
  createClosureRequestSchema,
  MEAL_TYPE_ORDER,
  type MealType,
} from '@ennel/shared';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/shared/api-client/api-error';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/shared/components/ui/dialog';
import { Checkbox, Field, Input, Select, Textarea } from '@/shared/components/ui/form-controls';
import { todayBusinessDate } from '@/shared/lib/format';
import { createClosure, getClosureImpact } from '../api/closures-api';
import { CLOSURE_KIND_LABELS, MEAL_NAMES } from '../constants/closure-labels';

interface Draft {
  date: string;
  mealTypes: MealType[];
  kind: ClosureKind;
  title: string;
  reason: string;
}

const emptyDraft = (): Draft => ({
  date: todayBusinessDate(),
  mealTypes: [],
  kind: 'MESS_CLOSED',
  title: '',
  reason: '',
});

/**
 * Admin §F: closes the mess for a date and meals. The number of bookings that will be cancelled
 * is shown before the manager confirms; the reason is mandatory and audited. The parent gives it a
 * new `key` each time it opens, so every closure starts from an empty form.
 */
export function CreateClosureDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const id = useId();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const save = useMutation({
    mutationFn: (body: CreateClosureRequest) => createClosure(body),
    onSuccess: ({ cancelled }) => {
      toast.success(`Closure applied. ${cancelled} booked meals were marked "Mess closed".`);
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: ['closures'] });
    },
  });
  const impact = useQuery({
    queryKey: ['closures', 'impact', draft.date, draft.mealTypes],
    queryFn: () => getClosureImpact(draft.date, draft.mealTypes),
    enabled: open && draft.mealTypes.length > 0 && draft.date >= todayBusinessDate(),
  });

  const toggleMeal = (mealType: MealType, isChecked: boolean) =>
    update({
      mealTypes: MEAL_TYPE_ORDER.filter((meal) =>
        meal === mealType ? isChecked : draft.mealTypes.includes(meal),
      ),
    });

  const submit = () => {
    const result = createClosureRequestSchema.safeParse(draft);
    if (!result.success) {
      setProblems(
        Object.fromEntries(
          result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
        ),
      );
      return;
    }
    setProblems({});
    save.mutate(result.data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="New closure"
        description="Booked meals become “Mess closed”, students are notified, and no No-show is recorded."
      >
        <div className="space-y-4">
          <Field label="Date" htmlFor={`${id}-date`} error={problems.date}>
            <Input
              id={`${id}-date`}
              type="date"
              min={todayBusinessDate()}
              value={draft.date}
              onChange={(event) => update({ date: event.target.value })}
            />
          </Field>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Meals</legend>
            <div className="flex flex-wrap gap-4">
              {MEAL_TYPE_ORDER.map((mealType) => (
                <label key={mealType} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.mealTypes.includes(mealType)}
                    onChange={(event) => toggleMeal(mealType, event.target.checked)}
                  />
                  {MEAL_NAMES[mealType]}
                </label>
              ))}
            </div>
            {problems.mealTypes ? (
              <p role="alert" className="text-sm text-danger">
                {problems.mealTypes}
              </p>
            ) : null}
          </fieldset>
          <Field label="Type" htmlFor={`${id}-kind`}>
            <Select
              id={`${id}-kind`}
              value={draft.kind}
              onChange={(event) => update({ kind: event.target.value as ClosureKind })}
            >
              {CLOSURE_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {CLOSURE_KIND_LABELS[kind]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Title (shown to students)" htmlFor={`${id}-title`} error={problems.title}>
            <Input
              id={`${id}-title`}
              value={draft.title}
              maxLength={120}
              placeholder="e.g. Diwali holiday"
              onChange={(event) => update({ title: event.target.value })}
            />
          </Field>
          <Field
            label="Reason (recorded in the audit log)"
            htmlFor={`${id}-reason`}
            error={problems.reason}
          >
            <Textarea
              id={`${id}-reason`}
              value={draft.reason}
              maxLength={500}
              onChange={(event) => update({ reason: event.target.value })}
            />
          </Field>
          <ImpactNote impact={impact} hasMeals={draft.mealTypes.length > 0} />
          {save.error ? (
            <p role="alert" className="text-sm text-danger">
              {errorMessage(save.error)}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={save.isPending} onClick={submit}>
            {save.isPending ? 'Applying…' : 'Apply closure'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImpactNote({
  impact,
  hasMeals,
}: {
  impact: UseQueryResult<ClosureImpact>;
  hasMeals: boolean;
}) {
  if (!hasMeals) return null;
  if (impact.isLoading) return <p className="text-sm text-muted-foreground">Counting bookings…</p>;
  if (impact.error) return <p className="text-sm text-danger">{errorMessage(impact.error)}</p>;
  if (!impact.data) return null;
  const parts = impact.data.meals.map(
    (meal) => `${MEAL_NAMES[meal.mealType]}: ${meal.bookedCount}`,
  );
  return (
    <p className="rounded-md bg-mint p-3 text-sm" role="status">
      <strong>{impact.data.totalBooked} booked meals will be cancelled</strong> ({parts.join(', ')}
      ).
    </p>
  );
}
