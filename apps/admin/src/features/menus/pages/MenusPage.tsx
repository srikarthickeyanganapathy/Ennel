import { type AdminMenu, type MenuItemInput } from '@ennel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { usePermissions } from '@/features/auth/auth-context';
import { errorMessage, isVersionConflict } from '@/shared/api-client/api-error';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { QueryBoundary } from '@/shared/components/QueryStates';
import { StatusBadge, type StatusTone } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { WeekPicker } from '@/shared/components/WeekPicker';
import { PageHeader } from '@/shared/layout/PageHeader';
import { addDays, startOfWeek, todayBusinessDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { getMenuWeek, saveMenu } from '../api/menus-api';
import { DishLibraryCard } from '../components/DishLibraryCard';
import { MenuEditorDialog } from '../components/MenuEditorDialog';
import { hasUnpublishedWork, MenuWeekGrid } from '../components/MenuWeekGrid';
import { CopyWeekDialog, PublishWeekDialog } from '../components/WeekDialogs';

function weekState(
  menus: AdminMenu[],
  unpublished: number,
): {
  label: string;
  tone: StatusTone;
  note: string;
} {
  if (unpublished > 0) {
    return {
      label: 'Draft',
      tone: 'warning',
      note: 'Published menu stays live until you publish this draft.',
    };
  }
  return menus.some((menu) => menu.status === 'PUBLISHED')
    ? { label: 'Published', tone: 'success', note: 'Everything saved this week is published.' }
    : { label: 'No menu', tone: 'neutral', note: 'No menus yet for this week.' };
}

/** Figma "Admin — Menu": the weekly draft and publish editor (Admin §E). */
export function MenusPage() {
  const can = usePermissions();
  const queryClient = useQueryClient();
  const today = todayBusinessDate();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  // Only the cell is remembered; the menu itself always comes from the latest week data.
  const [editingCell, setEditingCell] = useState<Pick<AdminMenu, 'mealDate' | 'mealType'> | null>(
    null,
  );
  const [isCopying, setIsCopying] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const week = useQuery({ queryKey: ['menus', weekStart], queryFn: () => getMenuWeek(weekStart) });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['menus'] });
  const addDish = useMutation({
    mutationFn: ({ menu, dish }: { menu: AdminMenu; dish: MenuItemInput }) =>
      saveMenu(menu.mealDate, menu.mealType, {
        items: [...menu.items, dish],
        isSpecial: menu.isSpecial,
        specialTitle: menu.specialTitle,
        version: menu.version ?? undefined,
      }),
    onSuccess: (_saved, { dish }) => {
      toast.success(`${dish.name} added to the draft.`);
      refresh();
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      if (isVersionConflict(error)) refresh();
    },
  });
  const onDropDish = (menu: AdminMenu, dish: MenuItemInput) => {
    const isOnMenu = menu.items.some(
      (item) => item.name === dish.name && item.dietType === dish.dietType,
    );
    if (isOnMenu) toast.info(`${dish.name} is already on this menu.`);
    else addDish.mutate({ menu, dish });
  };

  const menus = week.data?.menus ?? [];
  const unpublished = menus.filter(hasUnpublishedWork);
  const state = weekState(menus, unpublished.length);
  const canEdit = can('menus:update');
  const editing = editingCell
    ? (menus.find(
        (menu) => menu.mealDate === editingCell.mealDate && menu.mealType === editingCell.mealType,
      ) ?? null)
    : null;

  return (
    <div>
      <PageHeader
        title="Menu"
        breadcrumbs={[{ label: 'Menu' }]}
        description={
          unpublished.length > 0
            ? `Draft · ${unpublished.length} unpublished ${unpublished.length === 1 ? 'change' : 'changes'}`
            : state.label
        }
        actions={<WeekPicker weekStart={weekStart} onChange={setWeekStart} />}
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <StatusBadge label={state.label} tone={state.tone} />
        <p className="min-w-0 flex-1 basis-60 text-[13px] text-muted-foreground">{state.note}</p>
        <PermissionGate permissions={['menus:update']}>
          <Button
            variant="ghost"
            className="h-12 font-semibold text-primary"
            onClick={() => setIsCopying(true)}
          >
            Copy last week
          </Button>
        </PermissionGate>
        <PermissionGate permissions={['menus:publish']}>
          <Button
            className="h-12 font-semibold"
            disabled={unpublished.length === 0}
            onClick={() => setIsPublishing(true)}
          >
            Publish & notify students
          </Button>
        </PermissionGate>
      </div>
      <div
        className={cn(
          'grid grid-cols-[minmax(0,1fr)] items-start gap-6',
          canEdit && 'xl:grid-cols-[minmax(0,1fr)_280px]',
        )}
      >
        <QueryBoundary
          isLoading={week.isLoading}
          error={week.error}
          onRetry={() => void week.refetch()}
        >
          <MenuWeekGrid
            days={Array.from({ length: 7 }, (_, offset) => addDays(weekStart, offset))}
            today={today}
            menus={menus}
            canEdit={canEdit}
            onOpen={setEditingCell}
            onDropDish={onDropDish}
          />
        </QueryBoundary>
        {canEdit ? <DishLibraryCard /> : null}
      </div>
      <MenuEditorDialog menu={editing} onClose={() => setEditingCell(null)} />
      {isCopying ? <CopyWeekDialog weekStart={weekStart} open onOpenChange={setIsCopying} /> : null}
      {isPublishing ? (
        <PublishWeekDialog menus={unpublished} open onOpenChange={setIsPublishing} />
      ) : null}
    </div>
  );
}
