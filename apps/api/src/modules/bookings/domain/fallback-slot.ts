export interface SlotSpace {
  slotId: string;
  startMinute: number;
  hasSpace: boolean;
}

/**
 * BR-DEF-2 / ADR-0006 `AUTO_NEXT_AVAILABLE`: when the preferred slot is full, take the next later
 * slot with space, wrapping round to the earliest slots if none later has space. Slots that have
 * already started must be filtered out by the caller. Null when every slot is full.
 */
export function chooseFallbackSlot(
  preferredSlotId: string,
  slots: readonly SlotSpace[],
): string | null {
  const order = fallbackOrder(preferredSlotId, slots);
  return order.find((slotId) => slots.find((slot) => slot.slotId === slotId)?.hasSpace) ?? null;
}

/** The slots to try instead of the preferred one, in BR-DEF-2 order (later first, then wrap). */
export function fallbackOrder(
  preferredSlotId: string,
  slots: readonly Pick<SlotSpace, 'slotId' | 'startMinute'>[],
): string[] {
  const ordered = [...slots]
    .sort((a, b) => a.startMinute - b.startMinute)
    .map((slot) => slot.slotId);
  const preferredIndex = ordered.indexOf(preferredSlotId);
  if (preferredIndex < 0) return ordered;
  return [...ordered.slice(preferredIndex + 1), ...ordered.slice(0, preferredIndex)];
}
