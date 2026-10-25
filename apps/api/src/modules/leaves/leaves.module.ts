import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BookingsModule } from '../bookings/bookings.module';
import { DefaultPreferencesModule } from '../default-preferences/default-preferences.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { MessConfigModule } from '../mess-config/mess-config.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LeavesController } from './controllers/leaves.controller';
import { LeavesRepository } from './repositories/leaves.repository';
import { LeaveCommandsService } from './services/leave-commands.service';
import { LeaveNotices } from './services/leave-notices.service';
import { LeaveTimelineService } from './services/leave-timeline.service';
import { StudentLeavesService } from './services/student-leaves.service';

/** Leave Management (Spec §11, BR-LEAVE, Phase 8). Admin leave screens reuse its commands. */
@Module({
  imports: [
    AuthModule,
    BookingsModule,
    DefaultPreferencesModule,
    IdempotencyModule,
    MessConfigModule,
    NotificationsModule,
  ],
  controllers: [LeavesController],
  providers: [
    LeavesRepository,
    LeaveTimelineService,
    LeaveNotices,
    LeaveCommandsService,
    StudentLeavesService,
  ],
  exports: [LeavesRepository, LeaveTimelineService, LeaveCommandsService],
})
export class LeavesModule {}
