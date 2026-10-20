import { type AdminMenu, MEAL_TYPE_ORDER } from '@ennel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { QueryBoundary } from '@/shared/components/QueryStates';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/shared/components/ui/dialog';
import { Checkbox } from '@/shared/components/ui/form-controls';
import { errorMessage } from '@/shared/api-client/api-error';
import { PageHeader } from '@/shared/layout/PageHeader';
import { addDays, formatBusinessDate, startOfWeek, todayBusinessDate } from '@/shared/lib/format';
import { copyMenuWeek, getMenuWeek } from '../api/menus-api';
import { MenuEditorDialog } from '../components/MenuEditorDialog';

const MEAL_NAMES = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', DINNER: 'Dinner' } as const;

function menuStatus(menu: AdminMenu): {
  label: string;
  tone: 'success' | 'warning' | 'neutral' | 'info';
} {
  if (menu.status === 'NONE') return { label: 'No menu', tone: 'neutral' };
  if (menu.status === 'DRAFT') return { label: 'Draft', tone: 'info' };
  return menu.hasUnpublishedChanges
    ? { label: 'Published, edited', tone: 'warning' }
    : { label: 'Published', tone: 'success' };
}

/** Admin §E weekly menu editor with copy-from-previous-week. */
export function MenusPage() {
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayBusinessDate()));
  const [editing, setEditing] = useState<AdminMenu | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const week = useQuery({ queryKey: ['menus', weekStart], queryFn: () => getMenuWeek(weekStart) });
  const copy = useMutation({
    mutationFn: () => copyMenuWeek(addDays(weekStart, -7), weekStart, overwrite),
    onSuccess: ({ copied }) => {
      toast.success(`${copied} menus copied as drafts.`);
      setIsCopying(false);
      void queryClient.invalidateQueries({ queryKey: ['menus'] });
    },
  });
  const days = Array.from({ length: 7 }, (_, offset) => addDays(weekStart, offset));
  const find = (date: string, mealType: AdminMenu['mealType']) =>
    week.data?.menus.find((menu) => menu.mealDate === date && menu.mealType === mealType);

  return (
    <div>
      <PageHeader
        title="Menus"
        breadcrumbs={[{ label: 'Menus' }]}
        description={`Week of ${formatBusinessDate(weekStart, 'd MMM yyyy')}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              Previous week
            </Button>
            <Button
              variant="outline"
              onClick={() => setWeekStart(startOfWeek(todayBusinessDate()))}
            >
              This week
            </Button>
            <Button variant="outline" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              Next week
            </Button>
            <PermissionGate permissions={['menus:update']}>
              <Button onClick={() => setIsCopying(true)}>Copy previous week</Button>
            </PermissionGate>
          </>
        }
      />
      <QueryBoundary
        isLoading={week.isLoading}
        error={week.error}
        onRetry={() => void week.refetch()}
      >
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[900px] table-fixed text-sm">
            <caption className="sr-only">Menus for the week</caption>
            <thead className="bg-surface">
              <tr>
                <th scope="col" className="w-28 px-3 py-2 text-left">
                  Meal
                </th>
                {days.map((date) => (
                  <th key={date} scope="col" className="px-2 py-2 text-left">
                    {formatBusinessDate(date, 'EEE d MMM')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MEAL_TYPE_ORDER.map((mealType) => (
                <tr key={mealType} className="border-t border-border align-top">
                  <th scope="row" className="px-3 py-2 text-left">
                    {MEAL_NAMES[mealType]}
                  </th>
                  {days.map((date) => {
                    const menu = find(date, mealType);
                    if (!menu) return <td key={date} />;
                    const status = menuStatus(menu);
                    return (
                      <td key={date} className="px-2 py-2">
                        <button
                          type="button"
                          className="w-full rounded-md border border-border p-2 text-left hover:bg-mint focus-visible:outline-2"
                          onClick={() => setEditing(menu)}
                          aria-label={`Edit ${MEAL_NAMES[mealType]} on ${formatBusinessDate(date)}`}
                        >
                          <StatusBadge label={status.label} tone={status.tone} />
                          {menu.isSpecial ? (
                            <span className="mt-1 block text-xs font-semibold text-primary">
                              {menu.specialTitle}
                            </span>
                          ) : null}
                          <ul className="mt-1 space-y-0.5 text-xs">
                            {menu.items.map((item) => (
                              <li key={item.name}>
                                {item.name}{' '}
                                <span className="text-muted-foreground">
                                  ({item.dietType === 'VEG' ? 'Veg' : 'Non-Veg'})
                                </span>
                              </li>
                            ))}
                          </ul>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueryBoundary>
      <MenuEditorDialog menu={editing} onClose={() => setEditing(null)} />
      <Dialog open={isCopying} onOpenChange={setIsCopying}>
        <DialogContent
          title="Copy previous week?"
          description={`Menus from the week of ${formatBusinessDate(addDays(weekStart, -7), 'd MMM')} are copied here as drafts.`}
        >
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={overwrite}
              onChange={(event) => setOverwrite(event.target.checked)}
            />{' '}
            Replace menus that already exist this week
          </label>
          {copy.error ? (
            <p className="mt-2 text-sm text-danger">{errorMessage(copy.error)}</p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCopying(false)}>
              Cancel
            </Button>
            <Button disabled={copy.isPending} onClick={() => copy.mutate()}>
              Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
