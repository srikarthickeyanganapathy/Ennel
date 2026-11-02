import { Module } from '@nestjs/common';
import { AnnouncementsModule } from '../announcements/announcements.module';
import { AdminReportsModule } from '../admin/admin-reports/admin-reports.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { BookingsModule } from '../bookings/bookings.module';
import { MessConfigModule } from '../mess-config/mess-config.module';
import { JobRunsRepository } from './repositories/job-runs.repository';
import { CloseAttendanceWindowsService } from './services/close-attendance-windows.service';
import { GenerateDefaultBookingsService } from './services/generate-default-bookings.service';
import { GenerateReportExportsService } from './services/generate-report-exports.service';
import { JobRunRecorder } from './services/job-run-recorder.service';
import { SendScheduledAnnouncementsService } from './services/send-scheduled-announcements.service';

/** Background job logic (architecture §3.7). The BullMQ worker that runs it lives in WorkerModule. */
@Module({
  imports: [
    BookingsModule,
    MessConfigModule,
    AttendanceModule,
    AnnouncementsModule,
    AdminReportsModule,
  ],
  providers: [
    JobRunsRepository,
    JobRunRecorder,
    GenerateDefaultBookingsService,
    CloseAttendanceWindowsService,
    SendScheduledAnnouncementsService,
    GenerateReportExportsService,
  ],
  exports: [
    GenerateDefaultBookingsService,
    CloseAttendanceWindowsService,
    SendScheduledAnnouncementsService,
    GenerateReportExportsService,
  ],
})
export class JobsModule {}
