import { Module } from '@nestjs/common';
import { AttendanceModule } from '../../attendance/attendance.module';
import { JobsQueue } from '../../jobs/jobs-queue.service';
import { JobRunsRepository } from '../../jobs/repositories/job-runs.repository';
import { AdminAttendanceModule } from '../admin-attendance/admin-attendance.module';
import { AdminSystemController } from './controllers/admin-system.controller';
import { SystemHealthService } from './services/system-health.service';

/** System health (Admin §Q, Phase 11). */
@Module({
  imports: [AttendanceModule, AdminAttendanceModule],
  controllers: [AdminSystemController],
  providers: [SystemHealthService, JobsQueue, JobRunsRepository],
})
export class AdminSystemModule {}
