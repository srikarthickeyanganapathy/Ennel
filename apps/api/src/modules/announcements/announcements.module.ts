import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AnnouncementsRepository } from './repositories/announcements.repository';
import { AnnouncementSender } from './services/announcement-sender.service';

/** Announcement storage and sending, shared by the admin API and the worker (Admin §M). */
@Module({
  imports: [NotificationsModule],
  providers: [AnnouncementsRepository, AnnouncementSender],
  exports: [AnnouncementsRepository, AnnouncementSender],
})
export class AnnouncementsModule {}
