import { Injectable } from '@nestjs/common';
import { type NotificationCategory } from '@ennel/shared';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';
import { NotificationRepository } from '../repositories/notification.repository';

export interface StudentNotice {
  studentIds: string[];
  category: NotificationCategory;
  title: string;
  body: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  /** Combined with each student ID, so a repeated event never notifies twice (Spec §13). */
  dedupeKey: string;
}

/**
 * In-app notifications written in the caller's transaction, so a notice exists only if the
 * change it describes was committed. Push delivery is added with the notification centre (Phase 10).
 */
@Injectable()
export class NotifyStudentsService {
  constructor(private readonly notifications: NotificationRepository) {}

  notifyWithin(tx: TransactionClient, notice: StudentNotice): Promise<number> {
    const { studentIds, dedupeKey, ...content } = notice;
    return this.notifications.createMany(
      [...new Set(studentIds)].map((studentId) => ({
        ...content,
        studentId,
        dedupeKey: `${dedupeKey}:${studentId}`,
      })),
      tx,
    );
  }
}
