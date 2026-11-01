import { Injectable, Logger } from '@nestjs/common';
import { Clock } from '../../../infrastructure/clock/clock';
import { AnnouncementsRepository } from '../../announcements/repositories/announcements.repository';
import { AnnouncementSender } from '../../announcements/services/announcement-sender.service';

export const SEND_SCHEDULED_ANNOUNCEMENTS = 'send-scheduled-announcements';
/** A send still SENDING after this long has stopped; its pending pushes are retried. */
const STALLED_AFTER_MS = 5 * 60_000;

export interface AnnouncementRunSummary {
  sent: string[];
  pushRetried: string[];
  failed: string[];
}

/**
 * Runs every minute (Admin §M "scheduled sends run through BullMQ"): sends announcements whose
 * time has come and finishes pushes left pending. The status check in the sender keeps an
 * announcement from going out twice, even if "Send now" races the job.
 */
@Injectable()
export class SendScheduledAnnouncementsService {
  private readonly logger = new Logger(SendScheduledAnnouncementsService.name);

  constructor(
    private readonly announcements: AnnouncementsRepository,
    private readonly sender: AnnouncementSender,
    private readonly clock: Clock,
  ) {}

  async run(): Promise<AnnouncementRunSummary> {
    const summary: AnnouncementRunSummary = { sent: [], pushRetried: [], failed: [] };
    for (const id of await this.announcements.dueIds(this.clock.now())) {
      await this.attempt(id, summary, async () => {
        if (await this.sender.send(id, { from: ['SCHEDULED'] })) summary.sent.push(id);
      });
    }
    const stalledBefore = new Date(this.clock.now().getTime() - STALLED_AFTER_MS);
    for (const id of await this.announcements.sendingIds(stalledBefore)) {
      await this.attempt(id, summary, async () => {
        await this.sender.sendPending(id);
        summary.pushRetried.push(id);
      });
    }
    return summary;
  }

  private async attempt(
    id: string,
    summary: AnnouncementRunSummary,
    work: () => Promise<void>,
  ): Promise<void> {
    try {
      await work();
    } catch (error) {
      summary.failed.push(id);
      this.logger.error(
        `${SEND_SCHEDULED_ANNOUNCEMENTS} ${id} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
