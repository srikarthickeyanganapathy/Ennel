import { Module } from '@nestjs/common';
import { AnnouncementsModule } from '../../announcements/announcements.module';
import { AdminAnnouncementsController } from './controllers/admin-announcements.controller';
import { AdminAnnouncementsService } from './services/admin-announcements.service';

/** Announcements for staff (Admin §M, Phase 10). */
@Module({
  imports: [AnnouncementsModule],
  controllers: [AdminAnnouncementsController],
  providers: [AdminAnnouncementsService],
})
export class AdminAnnouncementsModule {}
