import { type AdminMeal } from '@ennel/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage, isVersionConflict } from '@/shared/api-client/api-error';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardHeader } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogFooter } from '@/shared/components/ui/dialog';
import { Field, Input } from '@/shared/components/ui/form-controls';
import { formatMinutes, minuteToTimeInput, timeInputToMinute } from '@/shared/lib/format';
import { updateMeal } from '../api/mess-config-api';

/** One meal's serving window (Admin §D). */
export function MealWindowCard({ meal }: { meal: AdminMeal }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [values, setValues] = useState(() => toValues(meal));
  // A newer version (a colleague's save, reloaded after a conflict) replaces the form values.
  const [syncedVersion, setSyncedVersion] = useState(meal.version);
  if (meal.version !== syncedVersion) {
    setSyncedVersion(meal.version);
    setValues(toValues(meal));
  }
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['mess-config'] });
  const save = useMutation({
    mutationFn: () =>
      updateMeal(meal.id, {
        displayName: values.displayName,
        serviceStartMinute: timeInputToMinute(values.start),
        serviceEndMinute: timeInputToMinute(values.end),
        attendanceGraceMinutes: Number(values.grace),
        version: meal.version,
      }),
    onSuccess: () => {
      toast.success(`${meal.displayName} saved.`);
      setIsEditing(false);
      refresh();
    },
    onError: (error) => isVersionConflict(error) && refresh(),
  });
  const isBreakfast = meal.mealType === 'BREAKFAST';

  return (
    <Card>
      <CardHeader
        title={`${meal.displayName} serving window`}
        description={`Serving ${formatMinutes(meal.serviceStartMinute)} - ${formatMinutes(meal.serviceEndMinute)} · attendance closes ${meal.attendanceGraceMinutes} min after service ends`}
        actions={
          <>
            {meal.isActive ? null : <StatusBadge label="Inactive" tone="danger" />}
            <PermissionGate permissions={['mess-config:update']}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => (setValues(toValues(meal)), save.reset(), setIsEditing(true))}
              >
                Edit serving window
              </Button>
            </PermissionGate>
          </>
        }
      />
      {isBreakfast ? (
        <p className="mb-3 text-sm text-muted-foreground">
          Breakfast has one serving window; its slot follows the window.
        </p>
      ) : null}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent
          title={`Edit ${meal.displayName}`}
          description={isBreakfast ? undefined : 'Every active slot must stay inside the window.'}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" htmlFor={`${meal.id}-name`}>
              <Input
                id={`${meal.id}-name`}
                value={values.displayName}
                onChange={(event) => setValues({ ...values, displayName: event.target.value })}
              />
            </Field>
            <Field label="Attendance grace (minutes)" htmlFor={`${meal.id}-grace`}>
              <Input
                id={`${meal.id}-grace`}
                type="number"
                min={0}
                max={240}
                value={values.grace}
                onChange={(event) => setValues({ ...values, grace: event.target.value })}
              />
            </Field>
            <Field label="Serving starts" htmlFor={`${meal.id}-start`}>
              <Input
                id={`${meal.id}-start`}
                type="time"
                value={values.start}
                onChange={(event) => setValues({ ...values, start: event.target.value })}
              />
            </Field>
            <Field label="Serving ends" htmlFor={`${meal.id}-end`}>
              <Input
                id={`${meal.id}-end`}
                type="time"
                value={values.end}
                onChange={(event) => setValues({ ...values, end: event.target.value })}
              />
            </Field>
          </div>
          {save.error ? (
            <p className="mt-3 text-sm text-danger">{errorMessage(save.error)}</p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function toValues(meal: AdminMeal) {
  return {
    displayName: meal.displayName,
    start: minuteToTimeInput(meal.serviceStartMinute),
    end: minuteToTimeInput(meal.serviceEndMinute),
    grace: String(meal.attendanceGraceMinutes),
  };
}
