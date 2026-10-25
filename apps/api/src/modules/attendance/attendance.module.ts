import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { DevAttendanceController } from './controllers/dev-attendance.controller';
import { DevVerificationService } from './services/dev-verification.service';
import { AttendanceProvider, UnconfiguredAttendanceProvider } from './provider/attendance-provider';
import { AttendanceRepository } from './repositories/attendance.repository';
import { AttendanceRecorder } from './services/attendance-recorder.service';
import { CloseAttendanceWindowService } from './services/close-attendance-window.service';

/**
 * Attendance core (Spec §7, Admin §I, Phase 7): the face-verification port, the single writer of
 * attendance records, and the window-closing logic used by the worker.
 */
@Module({
  imports: [BookingsModule],
  controllers: [DevAttendanceController],
  providers: [
    DevVerificationService,
    { provide: AttendanceProvider, useClass: UnconfiguredAttendanceProvider },
    AttendanceRepository,
    AttendanceRecorder,
    CloseAttendanceWindowService,
  ],
  exports: [
    AttendanceProvider,
    AttendanceRepository,
    AttendanceRecorder,
    CloseAttendanceWindowService,
  ],
})
export class AttendanceModule {}
