import { type AdminClosure } from '@ennel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { EmptyState, QueryBoundary } from '@/shared/components/QueryStates';
import { ReasonDialog } from '@/shared/components/ReasonDialog';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/form-controls';
import { PageHeader } from '@/shared/layout/PageHeader';
import { formatBusinessDate, formatDateTime } from '@/shared/lib/format';
import { listClosures, removeClosure } from '../api/closures-api';
import { CreateClosureDialog } from '../components/CreateClosureDialog';
import { CLOSURE_KIND_LABELS, MEAL_NAMES } from '../constants/closure-labels';

/** Admin §F: closures and holidays, with links to where special-meal days are set up. */
export function ClosuresPage() {
  const queryClient = useQueryClient();
  const [includeRemoved, setIncludeRemoved] = useState(false);
  // A new key per opening gives the create dialog a fresh, empty form.
  const [createKey, setCreateKey] = useState<number | null>(null);
  const [removing, setRemoving] = useState<AdminClosure | null>(null);
  const closures = useQuery({
    queryKey: ['closures', includeRemoved],
    queryFn: () => listClosures(includeRemoved),
  });
  const remove = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => removeClosure(id, reason),
    onSuccess: ({ restored, notRestored }) => {
      toast.success(
        `Closure removed. ${restored} bookings restored; ${notRestored} students were told they can book again.`,
      );
      setRemoving(null);
      void queryClient.invalidateQueries({ queryKey: ['closures'] });
    },
  });

  return (
    <div>
      <PageHeader
        title="Closures"
        breadcrumbs={[{ label: 'Closures' }]}
        description="Days or meals when the mess is closed. Closures from the last 30 days and all future ones are shown."
        actions={
          <PermissionGate permissions={['closures:manage']}>
            <Button onClick={() => setCreateKey(Date.now())}>New closure</Button>
          </PermissionGate>
        }
      />
      <p className="mb-4 text-sm text-muted-foreground">
        Special-meal days are set up without closing the mess: mark the menu as special on the{' '}
        <Link className="text-primary underline" to="/menus">
          Menus
        </Link>{' '}
        page, and raise slot capacity for that date in{' '}
        <Link className="text-primary underline" to="/mess-config">
          Mess configuration
        </Link>
        .
      </p>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <Checkbox
          checked={includeRemoved}
          onChange={(event) => setIncludeRemoved(event.target.checked)}
        />
        Show removed closures
      </label>
      <QueryBoundary
        isLoading={closures.isLoading}
        error={closures.error}
        onRetry={() => void closures.refetch()}
      >
        {closures.data?.length === 0 ? (
          <EmptyState title="No closures">The mess is open for every upcoming meal.</EmptyState>
        ) : (
          <ClosureTable
            items={closures.data ?? []}
            onRemove={(closure) => (remove.reset(), setRemoving(closure))}
          />
        )}
      </QueryBoundary>
      {createKey !== null ? (
        <CreateClosureDialog
          key={createKey}
          open
          onOpenChange={(isOpen) => (isOpen ? undefined : setCreateKey(null))}
        />
      ) : null}
      <ReasonDialog
        open={removing !== null}
        onOpenChange={(isOpen) => (isOpen ? undefined : setRemoving(null))}
        title="Remove this closure?"
        description="Cancelled bookings are restored where the slot still has seats and has not started. Other students are told they can book again."
        confirmLabel="Remove closure"
        isPending={remove.isPending}
        error={remove.error}
        onConfirm={(reason) => removing && remove.mutate({ id: removing.id, reason })}
      />
    </div>
  );
}

function ClosureTable({
  items,
  onRemove,
}: {
  items: AdminClosure[];
  onRemove: (closure: AdminClosure) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <caption className="sr-only">Closures</caption>
        <thead className="bg-surface text-left">
          <tr>
            <th scope="col" className="px-3 py-2">
              Date
            </th>
            <th scope="col" className="px-3 py-2">
              Meals
            </th>
            <th scope="col" className="px-3 py-2">
              Type
            </th>
            <th scope="col" className="px-3 py-2">
              Title and reason
            </th>
            <th scope="col" className="px-3 py-2">
              Status
            </th>
            <th scope="col" className="px-3 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((closure) => (
            <tr key={closure.id} className="border-t border-border align-top">
              <td className="px-3 py-2 whitespace-nowrap">{formatBusinessDate(closure.date)}</td>
              <td className="px-3 py-2">
                {closure.mealTypes.map((meal) => MEAL_NAMES[meal]).join(', ')}
              </td>
              <td className="px-3 py-2">{CLOSURE_KIND_LABELS[closure.kind]}</td>
              <td className="px-3 py-2">
                <span className="font-medium">{closure.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {closure.reason} · by {closure.createdByName}, {formatDateTime(closure.createdAt)}
                </span>
                {closure.status === 'REMOVED' ? (
                  <span className="block text-xs text-muted-foreground">
                    Removed by {closure.removedByName ?? '—'}, {formatDateTime(closure.removedAt)}:{' '}
                    {closure.removalReason}
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2">
                {closure.status === 'ACTIVE' ? (
                  <StatusBadge label="Active" tone="warning" />
                ) : (
                  <StatusBadge label="Removed" tone="neutral" />
                )}
              </td>
              <td className="px-3 py-2 text-right">
                {closure.status === 'ACTIVE' ? (
                  <PermissionGate permissions={['closures:manage']}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRemove(closure)}
                      aria-label={`Remove closure on ${formatBusinessDate(closure.date)}`}
                    >
                      Remove
                    </Button>
                  </PermissionGate>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
