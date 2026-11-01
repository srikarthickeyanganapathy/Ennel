import { Module } from '@nestjs/common';
import { AnnouncementsModule } from '../announcements/announcements.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { BookingsModule } from '../bookings/bookings.module';
import { MessConfigModule } from '../mess-config/mess-config.module';
import { JobRunsRepository } from './repositories/job-runs.repository';
import { CloseAttendanceWindowsService } from './services/close-attendance-windows.service';
import { GenerateDefaultBookingsService } from './services/generate-default-bookings.service';
import { JobRunRecorder } from './services/job-run-recorder.service';
import { SendScheduledAnnouncementsService } from './services/send-scheduled-announcements.service';

/** Background job logic (architecture §3.7). The BullMQ worker that runs it lives in WorkerModule. */
@Module({
  imports: [BookingsModule, MessConfigModule, AttendanceModule, AnnouncementsModule],
  providers: [
    JobRunsRepository,
    JobRunRecorder,
    GenerateDefaultBookingsService,
    CloseAttendanceWindowsService,
    SendScheduledAnnouncementsService,
  ],
  exports: [
    GenerateDefaultBookingsService,
    CloseAttendanceWindowsService,
    SendScheduledAnnouncementsService,
  ],
})
export class JobsModule {}
