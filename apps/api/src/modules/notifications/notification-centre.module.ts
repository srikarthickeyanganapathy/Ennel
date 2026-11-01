import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationsModule } from './notifications.module';
import { NotificationCentreService } from './services/notification-centre.service';

/** The student notification centre (Spec §13, Phase 10). */
@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [NotificationsController],
  providers: [NotificationCentreService],
})
export class NotificationCentreModule {}
