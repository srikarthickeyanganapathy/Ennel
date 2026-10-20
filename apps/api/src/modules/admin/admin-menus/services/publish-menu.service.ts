import { Injectable } from '@nestjs/common';
import { ErrorCode, NotificationCategory, type PublishMenuResponse } from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';
import { Clock } from '../../../../infrastructure/clock/clock';
import { TransactionRunner } from '../../../../infrastructure/database/transaction-runner';
import { NotifyStudentsService } from '../../../notifications/services/notify-students.service';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { hashMenuContent, isPublishedChange } from '../domain/menu-rules';
import { AdminMenusRepository, type StoredMenu } from '../repositories/admin-menus.repository';
import { toAdminMenu } from './menu-view';

const MEAL_NAMES = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', DINNER: 'Dinner' } as const;

// e.g. "Tue, 20 Oct"; business dates are calendar dates, so format them in UTC.
function formatDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/**
 * Publishes a menu (Admin §E). Republishing a changed menu notifies every student booked for
 * that meal ("menu changed", Spec §13); the first publish and unchanged republishes do not.
 */
@Injectable()
export class PublishMenuService {
  constructor(
    private readonly menus: AdminMenusRepository,
    private readonly notify: NotifyStudentsService,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly clock: Clock,
  ) {}

  execute(menuId: string, version: number): Promise<PublishMenuResponse> {
    return this.transactions.run(async (tx) => {
      const menu = await this.menus.findById(menuId, tx);
      if (!menu) throw new AppError(ErrorCode.NOT_FOUND, 'Menu not found.');
      if (menu.version !== version) {
        throw new AppError(
          ErrorCode.VERSION_CONFLICT,
          'Someone else changed this menu. Reload and try again.',
        );
      }
      if (menu.items.length === 0)
        throw new AppError(ErrorCode.VALIDATION_FAILED, 'Add at least one dish before publishing.');

      const contentHash = hashMenuContent(menu);
      const isChanged = isPublishedChange(menu.contentHash, contentHash);
      await this.menus.publish(
        menuId,
        { contentHash, items: menu.items, publishedAt: this.clock.now() },
        tx,
      );
      const notifiedStudents = isChanged ? await this.notifyBooked(menu, contentHash, tx) : 0;
      await this.audit.write(tx, {
        action: 'menu.publish',
        entityType: 'menu',
        entityId: menuId,
        before: { items: menu.publishedItems, contentHash: menu.contentHash },
        after: { items: menu.items, contentHash, notifiedStudents },
      });
      const published = await this.menus.findById(menuId, tx);
      if (!published) throw new AppError(ErrorCode.NOT_FOUND, 'Menu not found.');
      return { menu: toAdminMenu(published), isChanged, notifiedStudents };
    });
  }

  private async notifyBooked(
    menu: StoredMenu,
    contentHash: string,
    tx: Parameters<NotifyStudentsService['notifyWithin']>[0],
  ): Promise<number> {
    const studentIds = await this.menus.bookedStudentIds(menu.mealDate, menu.mealId, tx);
    return this.notify.notifyWithin(tx, {
      studentIds,
      category: NotificationCategory.MENU,
      title: `${MEAL_NAMES[menu.mealType]} menu changed`,
      body: `The ${MEAL_NAMES[menu.mealType].toLowerCase()} menu for ${formatDay(menu.mealDate)} has been updated.`,
      relatedEntityType: 'menu',
      relatedEntityId: menu.id,
      dedupeKey: `menu-changed:${menu.id}:${contentHash}`,
    });
  }
}
