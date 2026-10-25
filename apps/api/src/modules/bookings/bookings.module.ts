import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MessConfigModule } from '../mess-config/mess-config.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingHistoryController } from './controllers/booking-history.controller';
import { StudentBookingsController } from './controllers/student-bookings.controller';
import { BookingHistoryRepository } from './repositories/booking-history.repository';
import { BookingsRepository } from './repositories/bookings.repository';
import { BookingCommandsService } from './services/booking-commands.service';
import { BookingDayService } from './services/booking-day.service';
import { BookingHistoryService } from './services/booking-history.service';
import { BookingOutcomeService } from './services/booking-outcome.service';
import { BookingReconciler } from './services/booking-reconciler.service';
import { SeatAllocator } from './services/seat-allocator.service';
import { StudentBookingsService } from './services/student-bookings.service';

/** Booking engine: resolution, book, change, cancel, recurring reconciliation (Spec §4–5, §8, ADR-0003/0004). */
@Module({
  imports: [AuthModule, MessConfigModule, NotificationsModule],
  controllers: [StudentBookingsController, BookingHistoryController],
  providers: [
    BookingsRepository,
    BookingHistoryRepository,
    BookingHistoryService,
    SeatAllocator,
    BookingDayService,
    BookingCommandsService,
    BookingReconciler,
    BookingOutcomeService,
    StudentBookingsService,
  ],
  exports: [
    BookingsRepository,
    SeatAllocator,
    BookingDayService,
    BookingCommandsService,
    BookingReconciler,
    BookingOutcomeService,
  ],
})
export class BookingsModule {}
