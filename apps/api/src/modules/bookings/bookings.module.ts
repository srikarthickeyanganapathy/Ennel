import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MessConfigModule } from '../mess-config/mess-config.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StudentBookingsController } from './controllers/student-bookings.controller';
import { BookingsRepository } from './repositories/bookings.repository';
import { BookingCommandsService } from './services/booking-commands.service';
import { BookingDayService } from './services/booking-day.service';
import { BookingReconciler } from './services/booking-reconciler.service';
import { SeatAllocator } from './services/seat-allocator.service';
import { StudentBookingsService } from './services/student-bookings.service';

/** Booking engine (Phase 4): resolution, book, change, cancel (Spec §4–5, ADR-0003/0004). */
@Module({
  imports: [AuthModule, MessConfigModule, NotificationsModule],
  controllers: [StudentBookingsController],
  providers: [
    BookingsRepository,
    BookingDayService,
    BookingCommandsService,
    BookingReconciler,
    StudentBookingsService,
  ],
  exports: [
    BookingsRepository,
    SeatAllocator,
    BookingDayService,
    BookingCommandsService,
    BookingReconciler,
  ],
})
export class BookingsModule {}
