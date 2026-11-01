import { Module } from '@nestjs/common';
import { ComplaintsModule } from '../../complaints/complaints.module';
import { MessConfigModule } from '../../mess-config/mess-config.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { AdminComplaintsController } from './controllers/admin-complaints.controller';
import { AdminComplaintActionsService } from './services/admin-complaint-actions.service';
import { AdminComplaintsService } from './services/admin-complaints.service';

/** The staff complaint inbox (Admin §L, Phase 10). */
@Module({
  imports: [ComplaintsModule, MessConfigModule, NotificationsModule],
  controllers: [AdminComplaintsController],
  providers: [AdminComplaintsService, AdminComplaintActionsService],
})
export class AdminComplaintsModule {}
