import { Module } from '@nestjs/common';
import {
  NotificationRepository,
  PrismaNotificationRepository,
} from './repositories/notification.repository';
import { NotifyStudentsService } from './services/notify-students.service';
import { PushDispatcher } from './services/push-dispatcher.service';

/**
 * Writing student notifications and sending pushes. Imported by every module that notifies, so it
 * has no controller; the student notification centre is NotificationCentreModule.
 */
@Module({
  providers: [
    { provide: NotificationRepository, useClass: PrismaNotificationRepository },
    NotifyStudentsService,
    PushDispatcher,
  ],
  exports: [NotificationRepository, NotifyStudentsService, PushDispatcher],
})
export class NotificationsModule {}
