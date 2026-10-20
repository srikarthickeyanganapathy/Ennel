import { Injectable } from '@nestjs/common';
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

export abstract class NotificationRepository {
  /** Returns how many were new; rows whose dedupe key already exists are skipped (Spec §13). */
  abstract createMany(notifications: NewNotification[], tx: TransactionClient): Promise<number>;
}

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
}
