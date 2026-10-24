import { Module } from '@nestjs/common';
import { BookingsModule } from '../../bookings/bookings.module';
import { AdminBookingsController } from './controllers/admin-bookings.controller';
import { AdminBookingsRepository } from './repositories/admin-bookings.repository';
import { AdminBookingOverridesService } from './services/admin-booking-overrides.service';
import { BulkBookingsService } from './services/bulk-bookings.service';
import { ListAdminBookingsService } from './services/list-admin-bookings.service';

/** Bookings management (Admin §H): grid, overrides with reasons, bulk actions. */
@Module({
  imports: [BookingsModule],
  controllers: [AdminBookingsController],
  providers: [
    AdminBookingsRepository,
    ListAdminBookingsService,
    AdminBookingOverridesService,
    BulkBookingsService,
  ],
})
export class AdminBookingsModule {}
