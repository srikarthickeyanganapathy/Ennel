import { Module } from '@nestjs/common';
import {
  NotificationRepository,
  PrismaNotificationRepository,
} from './repositories/notification.repository';
import { NotifyStudentsService } from './services/notify-students.service';

/** Student notifications. The student notification centre and push arrive in Phase 10. */
@Module({
  providers: [
    { provide: NotificationRepository, useClass: PrismaNotificationRepository },
    NotifyStudentsService,
  ],
  exports: [NotifyStudentsService],
})
export class NotificationsModule {}
