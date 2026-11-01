import { Injectable } from '@nestjs/common';
import { Clock } from '../../../infrastructure/clock/clock';
import { TransactionRunner } from '../../../infrastructure/database/transaction-runner';
import { AuditWriter } from '../../admin/audit-log/services/audit-writer.service';
import { NotifyStudentsService } from '../../notifications/services/notify-students.service';
import { PushDispatcher } from '../../notifications/services/push-dispatcher.service';
import { type AnnouncementStatus } from '../domain/announcement-rules';
import { AnnouncementsRepository } from '../repositories/announcements.repository';

/** Large audiences write one notice per student, so allow more than the default timeout. */
const SEND_TIMEOUT_MS = 60_000;

export interface SendRequest {
  /** The statuses it may be sent from: DRAFT/SCHEDULED for "Send now", SCHEDULED for the job. */
  from: AnnouncementStatus[];
  version?: number;
}

/**
 * Admin §M sending. In-app notices, delivery rows, the status change and the audit entry commit
 * together; pushes go out afterwards and are retried by the worker while the status is SENDING.
 */
@Injectable()
export class AnnouncementSender {
  constructor(
    private readonly announcements: AnnouncementsRepository,
    private readonly notify: NotifyStudentsService,
    private readonly push: PushDispatcher,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly clock: Clock,
  ) {}

  /** Returns false when it was no longer sendable (a colleague or the worker got there first). */
  async send(id: string, request: SendRequest): Promise<boolean> {
    const sent = await this.transactions.run(
      async (tx) => {
        const announcement = await this.announcements.find(id, tx);
        if (!announcement) return null;
        const now = this.clock.now();
        const hasPush = announcement.channels.includes('PUSH');
        const isClaimed = await this.announcements.transition(
          id,
          { statuses: request.from, version: request.version },
          { status: hasPush ? 'SENDING' : 'SENT', sentAt: now },
          tx,
        );
        if (!isClaimed) return null;
        const { studentIds } = await this.announcements.resolveAudience(announcement.audience);
        await this.notify.notifyWithin(tx, {
          studentIds,
          category: 'ANNOUNCEMENT',
          title: announcement.title,
          body: announcement.body,
          relatedEntityType: 'announcement',
          relatedEntityId: id,
          dedupeKey: `announcement:${id}`,
        });
        await this.announcements.createDeliveries(id, studentIds, announcement.channels, now, tx);
        await this.audit.write(tx, {
          action: 'announcement.send',
          entityType: 'announcement',
          entityId: id,
          before: { status: announcement.status },
          after: { status: hasPush ? 'SENDING' : 'SENT', recipients: studentIds.length },
        });
        return { hasPush };
      },
      { timeoutMs: SEND_TIMEOUT_MS },
    );
    if (!sent) return false;
    if (sent.hasPush) await this.sendPending(id);
    return true;
  }

  /** Sends the pushes still pending and finishes the announcement; safe to repeat. */
  async sendPending(id: string): Promise<void> {
    const studentIds = await this.announcements.pendingPushStudentIds(id);
    const outcome = await this.push.send(studentIds, { type: 'announcement', id });
    await this.transactions.run(async (tx) => {
      const now = this.clock.now();
      await this.announcements.recordPush(
        id,
        { delivered: [...outcome.delivered], failed: [...outcome.failed] },
        now,
        tx,
      );
      await this.announcements.transition(id, { statuses: ['SENDING'] }, { status: 'SENT' }, tx);
    });
  }
}
