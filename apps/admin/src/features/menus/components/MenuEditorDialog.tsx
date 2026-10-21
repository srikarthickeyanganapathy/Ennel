import {
  type AdminMenu,
  DietType,
  menuItemInputSchema,
  type MenuItemInput,
  type MenuWeek,
} from '@ennel/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { usePermissions } from '@/features/auth/auth-context';
import { errorMessage, isVersionConflict } from '@/shared/api-client/api-error';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/shared/components/ui/dialog';
import { Checkbox, Field, Input, Select } from '@/shared/components/ui/form-controls';
import { formatBusinessDate } from '@/shared/lib/format';
import { publishMenu, saveMenu } from '../api/menus-api';

const MEAL_NAMES = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', DINNER: 'Dinner' } as const;

const replaceMenu = (entry: AdminMenu, saved: AdminMenu): AdminMenu =>
  entry.mealDate === saved.mealDate && entry.mealType === saved.mealType ? saved : entry;

/** Edit one date's meal menu as a draft, then publish (Admin §E). */
export function MenuEditorDialog({
  menu,
  onClose,
}: {
  menu: AdminMenu | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const can = usePermissions();
  const [items, setItems] = useState<MenuItemInput[]>([]);
  const [isSpecial, setIsSpecial] = useState(false);
  const [specialTitle, setSpecialTitle] = useState('');
  // The form follows the menu's identity and version, so it starts clean on every open and
  // picks up the latest saved menu after a save or a version conflict reload.
  const menuKey = menu ? `${menu.mealDate}|${menu.mealType}|${menu.version ?? 'new'}` : null;
  const [syncedKey, setSyncedKey] = useState<string | null>(null);
  if (menuKey !== syncedKey) {
    setSyncedKey(menuKey);
    if (menu) {
      setItems(menu.items.length > 0 ? menu.items : [{ name: '', dietType: DietType.VEG }]);
      setIsSpecial(menu.isSpecial);
      setSpecialTitle(menu.specialTitle ?? '');
    }
  }
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['menus'] });
  const onError = (error: Error) => {
    if (!isVersionConflict(error)) return;
    toast.error(`${errorMessage(error)} The latest menu has been loaded.`);
    refresh();
  };

  const validItems = items.filter((item) => menuItemInputSchema.safeParse(item).success);
  const draft = { items: validItems, isSpecial, specialTitle: isSpecial ? specialTitle : null };
  const save = useMutation({
    mutationFn: () => {
      if (!menu) throw new Error('No menu');
      return saveMenu(menu.mealDate, menu.mealType, {
        ...draft,
        version: menu.version ?? undefined,
      });
    },
    // Stay open on the saved draft so it can be published straight away.
    onSuccess: (saved) => {
      toast.success('Draft saved.');
      queryClient.setQueriesData<MenuWeek>({ queryKey: ['menus'] }, (week) =>
        week ? { ...week, menus: week.menus.map((entry) => replaceMenu(entry, saved)) } : week,
      );
      refresh();
    },
    onError,
  });
  const publish = useMutation({
    mutationFn: () => {
      if (!menu?.id || menu.version === null) throw new Error('Save the menu first');
      return publishMenu(menu.id, menu.version);
    },
    onSuccess: (result) => {
      toast.success(
        result.isChanged
          ? `Published. ${result.notifiedStudents} booked students were told the menu changed.`
          : 'Published.',
      );
      refresh();
      onClose();
    },
    onError,
  });
  const { reset: resetSave } = save;
  const { reset: resetPublish } = publish;
  useEffect(() => {
    resetSave();
    resetPublish();
  }, [menuKey, resetSave, resetPublish]);
  const isDirty =
    menu !== null &&
    JSON.stringify(draft) !==
      JSON.stringify({
        items: menu.items,
        isSpecial: menu.isSpecial,
        specialTitle: menu.isSpecial ? menu.specialTitle : null,
      });
  const canPublish =
    menu?.id &&
    !isDirty &&
    menu.items.length > 0 &&
    (menu.status !== 'PUBLISHED' || menu.hasUnpublishedChanges);

  return (
    <Dialog open={menu !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={menu ? `${MEAL_NAMES[menu.mealType]} · ${formatBusinessDate(menu.mealDate)}` : ''}
        className="max-w-xl"
      >
        {menu?.status === 'PUBLISHED' ? (
          <p className="mb-3 text-sm text-muted-foreground">
            Students currently see:{' '}
            {(menu.publishedItems ?? []).map((item) => item.name).join(', ') || 'nothing'}.
          </p>
        ) : null}
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={index} className="flex gap-2">
              <Input
                aria-label={`Dish ${index + 1}`}
                placeholder="Dish name"
                value={item.name}
                disabled={!can('menus:update')}
                onChange={(event) =>
                  setItems(
                    items.map((entry, position) =>
                      position === index ? { ...entry, name: event.target.value } : entry,
                    ),
                  )
                }
              />
              <Select
                aria-label={`Dish ${index + 1} type`}
                className="w-32"
                value={item.dietType}
                disabled={!can('menus:update')}
                onChange={(event) =>
                  setItems(
                    items.map((entry, position) =>
                      position === index
                        ? { ...entry, dietType: event.target.value as DietType }
                        : entry,
                    ),
                  )
                }
              >
                <option value={DietType.VEG}>Veg</option>
                <option value={DietType.NON_VEG}>Non-Veg</option>
              </Select>
              {can('menus:update') ? (
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Remove dish ${index + 1}`}
                  onClick={() => setItems(items.filter((_, position) => position !== index))}
                >
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        {can('menus:update') ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setItems([...items, { name: '', dietType: DietType.VEG }])}
            >
              Add dish
            </Button>
            <div className="mt-4 space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={isSpecial}
                  onChange={(event) => setIsSpecial(event.target.checked)}
                />{' '}
                Special meal (festival, event)
              </label>
              {isSpecial ? (
                <Field label="Special meal title" htmlFor="special-title">
                  <Input
                    id="special-title"
                    value={specialTitle}
                    onChange={(event) => setSpecialTitle(event.target.value)}
                  />
                </Field>
              ) : null}
            </div>
          </>
        ) : null}
        {(save.error ?? publish.error) ? (
          <p className="mt-3 text-sm text-danger">{errorMessage(save.error ?? publish.error)}</p>
        ) : null}
        <DialogFooter>
          {menu?.hasUnpublishedChanges && menu.status === 'PUBLISHED' ? (
            <StatusBadge label="Unpublished changes" tone="warning" />
          ) : null}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {can('menus:update') ? (
            <Button
              variant="outline"
              disabled={save.isPending || (!isDirty && menu?.id !== null)}
              onClick={() => save.mutate()}
            >
              Save draft
            </Button>
          ) : null}
          {can('menus:publish') ? (
            <Button
              disabled={!canPublish || publish.isPending}
              onClick={() => publish.mutate()}
              title={isDirty ? 'Save the draft first' : undefined}
            >
              Publish
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
