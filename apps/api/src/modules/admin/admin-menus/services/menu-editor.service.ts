import { Injectable } from '@nestjs/common';
import {
  addBusinessDays,
  type AdminMenu,
  type BusinessDate,
  ErrorCode,
  MEAL_TYPE_ORDER,
  type MealType,
  type MenuItemInput,
  type MenuWeek,
} from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';
import {
  type TransactionClient,
  TransactionRunner,
} from '../../../../infrastructure/database/transaction-runner';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { listDates } from '../domain/menu-rules';
import { AdminMenusRepository, type StoredMenu } from '../repositories/admin-menus.repository';
import { emptyMenu, toAdminMenu } from './menu-view';

export interface MenuEdit {
  mealDate: BusinessDate;
  mealType: MealType;
  items: MenuItemInput[];
  isSpecial?: boolean;
  specialTitle?: string | null;
  version?: number;
}

/** Weekly menu editor (Admin §E): drafts per date and meal, bulk save and copy-from-week. */
@Injectable()
export class MenuEditorService {
  constructor(
    private readonly menus: AdminMenusRepository,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
  ) {}

  async week(from: BusinessDate, days: number): Promise<MenuWeek> {
    const stored = await this.menus.listRange(from, addBusinessDays(from, days - 1));
    const byKey = new Map(stored.map((menu) => [`${menu.mealDate}|${menu.mealType}`, menu]));
    const menus = listDates(from, days).flatMap((date) =>
      MEAL_TYPE_ORDER.map((mealType) => {
        const menu = byKey.get(`${date}|${mealType}`);
        return menu ? toAdminMenu(menu) : emptyMenu(date, mealType);
      }),
    );
    return { from, days, menus };
  }

  save(edit: MenuEdit): Promise<AdminMenu> {
    return this.transactions.run((tx) => this.saveWithin(edit, tx));
  }

  saveMany(edits: MenuEdit[]): Promise<AdminMenu[]> {
    return this.transactions.run(async (tx) => {
      const saved: AdminMenu[] = [];
      for (const edit of edits) saved.push(await this.saveWithin(edit, tx));
      return saved;
    });
  }

  /** Copies item lists into drafts; existing target menus are skipped unless overwrite is set. */
  copyWeek(
    fromWeekStart: BusinessDate,
    toWeekStart: BusinessDate,
    overwrite: boolean,
  ): Promise<{ copied: number }> {
    return this.transactions.run(async (tx) => {
      const source = await this.menus.listRange(
        fromWeekStart,
        addBusinessDays(fromWeekStart, 6),
        tx,
      );
      let copied = 0;
      for (const menu of source.filter((candidate) => candidate.items.length > 0)) {
        const offset = listDates(fromWeekStart, 7).indexOf(menu.mealDate);
        const mealDate = addBusinessDays(toWeekStart, offset);
        const target = await this.menus.find(mealDate, menu.mealId, tx);
        if (target && !overwrite) continue;
        await this.saveWithin(
          { mealDate, mealType: menu.mealType, items: menu.items, version: target?.version },
          tx,
          false,
        );
        copied += 1;
      }
      await this.audit.write(tx, {
        action: 'menu.copy-week',
        entityType: 'menu',
        entityId: toWeekStart,
        after: { fromWeekStart, toWeekStart, overwrite, copied },
      });
      return { copied };
    });
  }

  private async saveWithin(
    edit: MenuEdit,
    tx: TransactionClient,
    shouldAudit = true,
  ): Promise<AdminMenu> {
    const mealId = (await this.menus.mealIdsByType(tx)).get(edit.mealType);
    if (!mealId) throw new AppError(ErrorCode.VALIDATION_FAILED, 'This meal is not active.');
    const existing = await this.menus.find(edit.mealDate, mealId, tx);
    const draft = {
      mealDate: edit.mealDate,
      mealId,
      items: edit.items,
      ...special(edit, existing),
    };
    const id = existing ? existing.id : await this.menus.create(draft, tx);
    if (
      existing &&
      (edit.version === undefined ||
        !(await this.menus.update(existing.id, edit.version, draft, tx)))
    ) {
      throw new AppError(
        ErrorCode.VERSION_CONFLICT,
        'Someone else changed this menu. Reload and try again.',
        {
          mealDate: edit.mealDate,
          mealType: edit.mealType,
        },
      );
    }
    const saved = await this.menus.findById(id, tx);
    if (!saved) throw new AppError(ErrorCode.NOT_FOUND, 'Menu not found.');
    if (shouldAudit) {
      await this.audit.write(tx, {
        action: existing ? 'menu.update' : 'menu.create',
        entityType: 'menu',
        entityId: id,
        before: existing ? { items: existing.items, isSpecial: existing.isSpecial } : undefined,
        after: {
          mealDate: saved.mealDate,
          mealType: saved.mealType,
          items: saved.items,
          isSpecial: saved.isSpecial,
        },
      });
    }
    return toAdminMenu(saved);
  }
}

/**
 * The bulk weekly editor and copy-week send items only; they must not silently clear a
 * special-meal day (Admin §F) that was set on the single-menu editor.
 */
function special(
  edit: MenuEdit,
  existing: StoredMenu | null,
): { isSpecial: boolean; specialTitle: string | null } {
  if (edit.isSpecial === undefined) {
    return {
      isSpecial: existing?.isSpecial ?? false,
      specialTitle: existing?.isSpecial ? existing.specialTitle : null,
    };
  }
  return {
    isSpecial: edit.isSpecial,
    specialTitle: edit.isSpecial ? (edit.specialTitle ?? null) : null,
  };
}
