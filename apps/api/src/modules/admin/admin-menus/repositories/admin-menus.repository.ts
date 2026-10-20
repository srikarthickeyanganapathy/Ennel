import { Injectable } from '@nestjs/common';
import { type BusinessDate, type MealType, type MenuItemInput } from '@ennel/shared';
import { type Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../../infrastructure/database/transaction-runner';

export interface StoredMenu {
  id: string;
  mealDate: BusinessDate;
  mealId: string;
  mealType: MealType;
  status: 'DRAFT' | 'PUBLISHED';
  isSpecial: boolean;
  specialTitle: string | null;
  items: MenuItemInput[];
  publishedItems: MenuItemInput[] | null;
  contentHash: string | null;
  publishedAt: Date | null;
  version: number;
}

export interface MenuDraft {
  mealDate: BusinessDate;
  mealId: string;
  items: MenuItemInput[];
  isSpecial: boolean;
  specialTitle: string | null;
}

export interface PublishedSnapshot {
  contentHash: string;
  items: MenuItemInput[];
  publishedAt: Date;
}

const toDate = (date: BusinessDate) => new Date(`${date}T00:00:00Z`);
const MENU_INCLUDE = {
  meal: { select: { mealType: true } },
  items: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.MenuInclude;
type MenuRow = Prisma.MenuGetPayload<{ include: typeof MENU_INCLUDE }>;

function toMenu(row: MenuRow): StoredMenu {
  return {
    id: row.id,
    mealDate: row.mealDate.toISOString().slice(0, 10),
    mealId: row.mealId,
    mealType: row.meal.mealType,
    status: row.status,
    isSpecial: row.isSpecial,
    specialTitle: row.specialTitle,
    items: row.items.map((item) => ({ name: item.name, dietType: item.dietType })),
    publishedItems: (row.publishedItems as MenuItemInput[] | null) ?? null,
    contentHash: row.contentHash,
    publishedAt: row.publishedAt,
    version: row.version,
  };
}

@Injectable()
export class AdminMenusRepository {
  constructor(private readonly prisma: PrismaService) {}

  async mealIdsByType(tx: TransactionClient = this.prisma): Promise<Map<MealType, string>> {
    const meals = await tx.meal.findMany({
      where: { isActive: true },
      select: { id: true, mealType: true },
    });
    return new Map(meals.map((meal) => [meal.mealType, meal.id]));
  }

  async listRange(
    from: BusinessDate,
    to: BusinessDate,
    tx: TransactionClient = this.prisma,
  ): Promise<StoredMenu[]> {
    const rows = await tx.menu.findMany({
      where: { mealDate: { gte: toDate(from), lte: toDate(to) } },
      include: MENU_INCLUDE,
    });
    return rows.map(toMenu);
  }

  async find(
    mealDate: BusinessDate,
    mealId: string,
    tx: TransactionClient = this.prisma,
  ): Promise<StoredMenu | null> {
    const row = await tx.menu.findUnique({
      where: { mealDate_mealId: { mealDate: toDate(mealDate), mealId } },
      include: MENU_INCLUDE,
    });
    return row ? toMenu(row) : null;
  }

  async findById(id: string, tx: TransactionClient = this.prisma): Promise<StoredMenu | null> {
    const row = await tx.menu.findUnique({ where: { id }, include: MENU_INCLUDE });
    return row ? toMenu(row) : null;
  }

  async create(draft: MenuDraft, tx: TransactionClient): Promise<string> {
    const menu = await tx.menu.create({
      data: {
        mealDate: toDate(draft.mealDate),
        mealId: draft.mealId,
        isSpecial: draft.isSpecial,
        specialTitle: draft.specialTitle,
        items: { create: draft.items.map((item, index) => ({ ...item, sortOrder: index + 1 })) },
      },
      select: { id: true },
    });
    return menu.id;
  }

  /** Replaces the draft items; the published snapshot is untouched until the next publish. */
  async update(
    id: string,
    version: number,
    draft: MenuDraft,
    tx: TransactionClient,
  ): Promise<boolean> {
    const result = await tx.menu.updateMany({
      where: { id, version },
      data: {
        isSpecial: draft.isSpecial,
        specialTitle: draft.specialTitle,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) return false;
    await tx.menuItem.deleteMany({ where: { menuId: id } });
    await tx.menuItem.createMany({
      data: draft.items.map((item, index) => ({ menuId: id, ...item, sortOrder: index + 1 })),
    });
    return true;
  }

  async publish(id: string, snapshot: PublishedSnapshot, tx: TransactionClient): Promise<void> {
    await tx.menu.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        contentHash: snapshot.contentHash,
        publishedItems: snapshot.items as unknown as Prisma.InputJsonValue,
        publishedAt: snapshot.publishedAt,
        version: { increment: 1 },
      },
    });
  }

  /** Students with a live booking for the meal, who should hear about a menu change. */
  async bookedStudentIds(
    mealDate: BusinessDate,
    mealId: string,
    tx: TransactionClient,
  ): Promise<string[]> {
    const rows = await tx.booking.findMany({
      where: { mealDate: toDate(mealDate), mealId, status: 'BOOKED' },
      select: { studentId: true },
    });
    return rows.map((row) => row.studentId);
  }
}
