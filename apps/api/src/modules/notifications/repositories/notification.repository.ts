import { Injectable } from '@nestjs/common';
import { type StudentNotification } from '@ennel/shared';
import { type NotificationCategory } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';

export interface NewNotification {
  studentId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  dedupeKey: string;
}

export interface NotificationFilter {
  studentId: string;
  category?: NotificationCategory;
  unreadOnly: boolean;
}

export interface StoredPushToken {
  studentId: string;
  token: string;
}

export abstract class NotificationRepository {
  /** Returns how many were new; rows whose dedupe key already exists are skipped (Spec §13). */
  abstract createMany(notifications: NewNotification[], tx: TransactionClient): Promise<number>;
  abstract list(
    filter: NotificationFilter,
    page: { skip: number; take: number },
  ): Promise<{ items: StudentNotification[]; total: number }>;
  abstract unreadCount(studentId: string): Promise<number>;
  /** False when the notification is not the student's. Reading twice keeps the first time. */
  abstract markRead(studentId: string, id: string, now: Date): Promise<boolean>;
  abstract markAllRead(studentId: string, now: Date): Promise<number>;
  abstract upsertPushToken(studentId: string, token: string, platform: string): Promise<void>;
  abstract pushTokensFor(studentIds: readonly string[]): Promise<StoredPushToken[]>;
  /** Drops tokens the push service reported as no longer registered. */
  abstract removePushTokens(tokens: readonly string[]): Promise<void>;
}

const NOTIFICATION_SELECT = {
  id: true,
  category: true,
  title: true,
  body: true,
  relatedEntityType: true,
  relatedEntityId: true,
  readAt: true,
  createdAt: true,
} as const;

@Injectable()
export class PrismaNotificationRepository extends NotificationRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async createMany(
    notifications: NewNotification[],
    tx: TransactionClient = this.prisma,
  ): Promise<number> {
    if (notifications.length === 0) return 0;
    const result = await tx.notification.createMany({ data: notifications, skipDuplicates: true });
    return result.count;
  }

  async list(
    filter: NotificationFilter,
    page: { skip: number; take: number },
  ): Promise<{ items: StudentNotification[]; total: number }> {
    const where = {
      studentId: filter.studentId,
      ...(filter.category && { category: filter.category }),
      ...(filter.unreadOnly && { readAt: null }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        select: NOTIFICATION_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...page,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({
        ...row,
        readAt: row.readAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
    };
  }

  unreadCount(studentId: string): Promise<number> {
    return this.prisma.notification.count({ where: { studentId, readAt: null } });
  }

  async markRead(studentId: string, id: string, now: Date): Promise<boolean> {
    const owned = await this.prisma.notification.count({ where: { id, studentId } });
    if (owned === 0) return false;
    await this.prisma.notification.updateMany({
      where: { id, studentId, readAt: null },
      data: { readAt: now },
    });
    return true;
  }

  async markAllRead(studentId: string, now: Date): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { studentId, readAt: null },
      data: { readAt: now },
    });
    return result.count;
  }

  async upsertPushToken(studentId: string, token: string, platform: string): Promise<void> {
    // A device that changes hands moves its token to the new student.
    await this.prisma.pushToken.upsert({
      where: { token },
      create: { studentId, token, platform },
      update: { studentId, platform },
    });
  }

  pushTokensFor(studentIds: readonly string[]): Promise<StoredPushToken[]> {
    if (studentIds.length === 0) return Promise.resolve([]);
    return this.prisma.pushToken.findMany({
      where: { studentId: { in: [...studentIds] } },
      select: { studentId: true, token: true },
    });
  }

  async removePushTokens(tokens: readonly string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.prisma.pushToken.deleteMany({ where: { token: { in: [...tokens] } } });
  }
}
