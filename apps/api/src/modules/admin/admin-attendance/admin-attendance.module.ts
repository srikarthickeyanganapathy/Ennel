import { Module } from '@nestjs/common';
import { AttendanceModule } from '../../attendance/attendance.module';
import { BookingsModule } from '../../bookings/bookings.module';
import { AdminAttendanceController } from './controllers/admin-attendance.controller';
import { AdminAttendanceRepository } from './repositories/admin-attendance.repository';
import { AttendanceCounterService } from './services/attendance-counter.service';
import { AttendanceImportService } from './services/attendance-import.service';
import { MarkAttendanceService } from './services/mark-attendance.service';
import { OutageService } from './services/outage.service';

/** Live counter, manual marking, outage mode and attendance import (Admin §I, Phase 7). */
@Module({
  imports: [AttendanceModule, BookingsModule],
  controllers: [AdminAttendanceController],
  providers: [
    AdminAttendanceRepository,
    AttendanceCounterService,
    MarkAttendanceService,
    OutageService,
    AttendanceImportService,
  ],
  exports: [AdminAttendanceRepository],
})
export class AdminAttendanceModule {}
