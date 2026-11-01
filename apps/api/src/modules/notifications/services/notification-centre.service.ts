import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  type NotificationList,
  type notificationListQuerySchema,
  type RegisterPushTokenRequest,
} from '@ennel/shared';
import { type z } from 'zod';
import { AppError } from '../../../common/errors/app-error';
import { Clock } from '../../../infrastructure/clock/clock';
import { NotificationRepository } from '../repositories/notification.repository';

type ListQuery = z.output<typeof notificationListQuerySchema>;

/** The student notification centre (Spec §13): list, unread count, mark read, push devices. */
@Injectable()
export class NotificationCentreService {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly clock: Clock,
  ) {}

  async list(studentId: string, query: ListQuery): Promise<NotificationList> {
    const [page, unreadCount] = await Promise.all([
      this.notifications.list(
        { studentId, category: query.category, unreadOnly: query.unreadOnly },
        { skip: (query.page - 1) * query.pageSize, take: query.pageSize },
      ),
      this.notifications.unreadCount(studentId),
    ]);
    return { ...page, page: query.page, pageSize: query.pageSize, unreadCount };
  }

  async unreadCount(studentId: string): Promise<{ unreadCount: number }> {
    return { unreadCount: await this.notifications.unreadCount(studentId) };
  }

  async markRead(studentId: string, id: string): Promise<{ unreadCount: number }> {
    const found = await this.notifications.markRead(studentId, id, this.clock.now());
    if (!found) throw new AppError(ErrorCode.NOT_FOUND, 'This notification was not found.');
    return this.unreadCount(studentId);
  }

  async markAllRead(studentId: string): Promise<{ unreadCount: number }> {
    await this.notifications.markAllRead(studentId, this.clock.now());
    return { unreadCount: 0 };
  }

  registerPushToken(studentId: string, body: RegisterPushTokenRequest): Promise<void> {
    return this.notifications.upsertPushToken(studentId, body.token, body.platform);
  }
}
