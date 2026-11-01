import { Module } from '@nestjs/common';
import { MessConfigModule } from '../../mess-config/mess-config.module';
import { NoShowsModule } from '../../no-shows/no-shows.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import {
  AdminNoShowAppealsController,
  AdminNoShowsController,
  AdminStudentNoShowsController,
} from './controllers/admin-no-shows.controller';
import { AdminNoShowsRepository } from './repositories/admin-no-shows.repository';
import { AdminNoShowsService } from './services/admin-no-shows.service';

/** No-show management and appeals for staff (Admin §J, Phase 9). */
@Module({
  imports: [NoShowsModule, MessConfigModule, NotificationsModule],
  controllers: [
    AdminNoShowsController,
    AdminNoShowAppealsController,
    AdminStudentNoShowsController,
  ],
  providers: [AdminNoShowsRepository, AdminNoShowsService],
})
export class AdminNoShowsModule {}
