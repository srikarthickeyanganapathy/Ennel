import { type AdminMeal, type AdminSlot, type SlotAvailability } from '@ennel/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { usePermissions } from '@/features/auth/auth-context';
import { errorMessage, isVersionConflict } from '@/shared/api-client/api-error';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogFooter } from '@/shared/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Input } from '@/shared/components/ui/form-controls';
import { cn } from '@/shared/lib/utils';
import { getCapacityImpact, updateSlot } from '../api/mess-config-api';
import { STATUS_DISPLAY } from '../constants/slot-status';
import { CapacityDialog } from './CapacityDialog';
import { SlotLifecycleDialog, type SlotLifecycleAction } from './SlotLifecycleDialog';
import { SlotFormDialog } from './SlotFormDialog';

const HEAD = 'px-3 py-3.5 text-left text-xs font-semibold whitespace-nowrap text-muted-foreground';
const CELL = 'px-3 py-3.5 text-sm whitespace-nowrap';

interface CapacityChange {
  slot: AdminSlot;
  capacity: number;
}
interface LoweringImpact {
  label: string;
  dates: number;
  overBy: number;
}

interface SlotsTableProps {
  meal: AdminMeal;
  availability: SlotAvailability[];
  isAdding: boolean;
  onAddingChange: (isAdding: boolean) => void;
}

/**
 * Figma slots table (Admin §D): default capacity is edited in the row and saved together. Lowering
 * below current bookings shows the impact first. Each slot saves on its own with its version.
 */
export function SlotsTable({ meal, availability, isAdding, onAddingChange }: SlotsTableProps) {
  const queryClient = useQueryClient();
  const canEdit = usePermissions()('mess-config:update');
  // Ids, not snapshots, so the dialogs always show the latest version of the slot.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [capacityForId, setCapacityForId] = useState<string | null>(null);
  const [lifecycle, setLifecycle] = useState<SlotLifecycleAction | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [impacts, setImpacts] = useState<LoweringImpact[] | null>(null);
  const editingSlot = meal.slots.find((slot) => slot.id === editingId) ?? null;
  const capacityFor = meal.slots.find((slot) => slot.id === capacityForId) ?? null;
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['mess-config'] });

  const changes: CapacityChange[] = meal.slots.flatMap((slot) => {
    const draft = drafts[slot.id];
    if (draft === undefined || draft === '') return [];
    const capacity = Number(draft);
    return capacity === slot.defaultCapacity ? [] : [{ slot, capacity }];
  });
  const hasEmpty = Object.values(drafts).some((draft) => draft === '');

  const check = useMutation({
    mutationFn: async () => {
      const lowered = changes.filter(({ slot, capacity }) => capacity < slot.defaultCapacity);
      const found = await Promise.all(
        lowered.map(async ({ slot, capacity }) => {
          const impact = await getCapacityImpact(slot.id, { capacity, scope: 'DEFAULT' });
          return {
            label: slot.label,
            dates: impact.affectedDates.length,
            overBy: impact.totalOverBy,
          };
        }),
      );
      return found.filter((impact) => impact.dates > 0);
    },
    onSuccess: (found) => (found.length > 0 ? setImpacts(found) : save.mutate()),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const save = useMutation({
    mutationFn: async () => {
      for (const { slot, capacity } of changes) {
        await updateSlot(slot.id, {
          startMinute: slot.startMinute,
          endMinute: slot.endMinute,
          defaultCapacity: capacity,
          version: slot.version,
        });
      }
    },
    onSuccess: () => {
      toast.success(changes.length === 1 ? 'Capacity saved.' : 'Capacities saved.');
      setDrafts({});
      setImpacts(null);
    },
    onError: (error) => {
      setImpacts(null);
      toast.error(errorMessage(error));
      if (isVersionConflict(error)) setDrafts({});
    },
    onSettled: refresh,
  });
  const isBusy = check.isPending || save.isPending;
  const isBreakfast = meal.mealType === 'BREAKFAST';

  return (
    <>
      <Card className="p-0">
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <caption className="sr-only">{meal.displayName} slots</caption>
            <thead className="bg-neutral-surface">
              <tr>
                <th scope="col" className={cn(HEAD, 'pl-5')}>
                  Slot
                </th>
                <th scope="col" className={HEAD}>
                  Capacity
                </th>
                <th scope="col" className={HEAD}>
                  Booked today
                </th>
                <th scope="col" className={HEAD}>
                  Occupancy
                </th>
                <th scope="col" className={HEAD}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {meal.slots.map((slot) => (
                <SlotRow
                  key={slot.id}
                  slot={slot}
                  live={availability.find((item) => item.slotId === slot.id) ?? null}
                  canEdit={canEdit}
                  draft={drafts[slot.id]}
                  onDraft={(value) => setDrafts({ ...drafts, [slot.id]: value })}
                >
                  <SlotActions
                    slot={slot}
                    canEdit={canEdit}
                    canRemove={!isBreakfast}
                    onCapacity={() => setCapacityForId(slot.id)}
                    onEdit={() => setEditingId(slot.id)}
                    onLifecycle={setLifecycle}
                  />
                </SlotRow>
              ))}
            </tbody>
          </table>
        </div>
        {changes.length > 0 || hasEmpty ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-border bg-surface px-5 py-3.5">
            <p className="min-w-0 flex-1 basis-60 text-[13px] font-medium">
              {hasEmpty
                ? 'Enter a capacity for every edited slot.'
                : `${changes.length} unsaved ${changes.length === 1 ? 'change' : 'changes'} · ${changes
                    .map(
                      ({ slot, capacity }) => `${slot.label} ${slot.defaultCapacity} → ${capacity}`,
                    )
                    .join(', ')}`}
            </p>
            <Button
              variant="ghost"
              className="h-12 font-semibold text-primary"
              disabled={isBusy}
              onClick={() => setDrafts({})}
            >
              Discard
            </Button>
            <Button
              className="h-12 font-semibold"
              disabled={isBusy || hasEmpty}
              onClick={() => check.mutate()}
            >
              {isBusy ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        ) : null}
      </Card>
      <Dialog open={impacts !== null} onOpenChange={(open) => !open && setImpacts(null)}>
        <DialogContent
          title="Lower capacity below current bookings?"
          description="Students already booked keep their bookings, and those slots show as over capacity."
        >
          <ul role="alert" className="space-y-1 text-sm">
            {(impacts ?? []).map((impact) => (
              <li key={impact.label}>
                <strong>{impact.label}</strong>: {impact.overBy} over on {impact.dates}{' '}
                {impact.dates === 1 ? 'date' : 'dates'}
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImpacts(null)}>
              Cancel
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              Lower capacity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <SlotFormDialog
        meal={meal}
        slot={editingSlot}
        open={isAdding || editingSlot !== null}
        onOpenChange={(open) => {
          if (open) return;
          setEditingId(null);
          onAddingChange(false);
        }}
      />
      {capacityFor ? (
        <CapacityDialog
          slot={capacityFor}
          open
          onOpenChange={(open) => !open && setCapacityForId(null)}
        />
      ) : null}
      <SlotLifecycleDialog meal={meal} action={lifecycle} onClose={() => setLifecycle(null)} />
    </>
  );
}

function SlotRow({
  slot,
  live,
  canEdit,
  draft,
  onDraft,
  children,
}: {
  slot: AdminSlot;
  live: SlotAvailability | null;
  canEdit: boolean;
  draft: string | undefined;
  onDraft: (value: string) => void;
  children: React.ReactNode;
}) {
  const value = draft ?? String(slot.defaultCapacity);
  const isEdited = value !== String(slot.defaultCapacity);
  return (
    <tr className={cn('border-t border-border', isEdited && 'bg-mint')}>
      <th scope="row" className={cn(CELL, 'pl-5 text-left font-semibold')}>
        {slot.label}
        {slot.isActive ? null : (
          <span className="ml-2">
            <StatusBadge label="Disabled" tone="neutral" />
          </span>
        )}
      </th>
      <td className={CELL}>
        {canEdit ? (
          <Input
            type="number"
            min={0}
            aria-label={`Capacity for ${slot.label}`}
            className={cn(
              'w-[76px] border-[1.5px] border-border font-medium shadow-none',
              isEdited && 'border-2 border-primary',
            )}
            value={value}
            onChange={(event) => onDraft(event.target.value)}
          />
        ) : (
          slot.defaultCapacity
        )}
      </td>
      <td className={CELL}>{live ? `${live.bookedCount} / ${live.officialCapacity}` : '—'}</td>
      <td className={CELL}>{live ? <Occupancy live={live} /> : '—'}</td>
      <td className={cn(CELL, 'text-right')}>{children}</td>
    </tr>
  );
}

function Occupancy({ live }: { live: SlotAvailability }) {
  const display = STATUS_DISPLAY[live.status];
  return (
    <span className="flex w-[120px] flex-col gap-1">
      <span className={cn('flex items-center gap-1.5', display.text)}>
        <span className="text-[13px] font-semibold">{live.occupancyPct}%</span>
        {live.status === 'AVAILABLE' ? null : (
          <span className="text-[11px] font-medium">{display.label}</span>
        )}
      </span>
      <span aria-hidden className="h-1.5 overflow-hidden rounded-[3px] bg-neutral-surface">
        <span
          className={cn('block h-full rounded-[3px]', display.bar)}
          style={{ width: `${Math.min(100, live.occupancyPct)}%` }}
        />
      </span>
    </span>
  );
}

function SlotActions({
  slot,
  canEdit,
  canRemove,
  onCapacity,
  onEdit,
  onLifecycle,
}: {
  slot: AdminSlot;
  canEdit: boolean;
  canRemove: boolean;
  onCapacity: () => void;
  onEdit: () => void;
  onLifecycle: (action: SlotLifecycleAction) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${slot.label}`}>
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onCapacity}>Capacity by day and date</DropdownMenuItem>
        {canEdit ? <DropdownMenuItem onSelect={onEdit}>Edit times</DropdownMenuItem> : null}
        {canEdit && canRemove ? (
          <>
            <DropdownMenuItem
              onSelect={() => onLifecycle({ kind: slot.isActive ? 'disable' : 'enable', slot })}
            >
              {slot.isActive ? 'Disable' : 'Enable'}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onLifecycle({ kind: 'delete', slot })}>
              Delete
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
