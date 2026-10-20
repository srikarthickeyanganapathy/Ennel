import { createHash } from 'node:crypto';
import { addBusinessDays, type BusinessDate, type MenuItemInput } from '@ennel/shared';

export interface MenuContent {
  items: MenuItemInput[];
  isSpecial: boolean;
  specialTitle: string | null;
}

/** Stable fingerprint of what students see; a different hash on publish means "menu changed" (Admin §E). */
export function hashMenuContent(content: MenuContent): string {
  const normalized = {
    items: content.items.map((item) => ({ name: item.name.trim(), dietType: item.dietType })),
    isSpecial: content.isSpecial,
    specialTitle: content.isSpecial ? (content.specialTitle?.trim() ?? null) : null,
  };
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

/**
 * Students are told only when an already-published menu changes; the first publish is not a
 * change (Admin §E).
 */
export function isPublishedChange(previousHash: string | null, nextHash: string): boolean {
  return previousHash !== null && previousHash !== nextHash;
}

export function listDates(from: BusinessDate, days: number): BusinessDate[] {
  return Array.from({ length: days }, (_, offset) => addBusinessDays(from, offset));
}
