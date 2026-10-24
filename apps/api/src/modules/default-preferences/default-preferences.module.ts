import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BookingsModule } from '../bookings/bookings.module';
import { MessConfigModule } from '../mess-config/mess-config.module';
import { SlotsModule } from '../slots/slots.module';
import { DefaultPreferencesController } from './controllers/default-preferences.controller';
import {
  MealPreferenceRepository,
  PrismaMealPreferenceRepository,
} from './repositories/meal-preference.repository';
import { DefaultPreferencesService } from './services/default-preferences.service';
import { SaveMealPreferencesService } from './services/save-meal-preferences.service';
import { SyncStudentBookingsService } from './services/sync-student-bookings.service';

/** Default Booking preferences and the student Default Booking page (Spec §8, Phase 5). */
@Module({
  imports: [AuthModule, MessConfigModule, BookingsModule, SlotsModule],
  controllers: [DefaultPreferencesController],
  providers: [
    { provide: MealPreferenceRepository, useClass: PrismaMealPreferenceRepository },
    SaveMealPreferencesService,
    SyncStudentBookingsService,
    DefaultPreferencesService,
  ],
  exports: [SaveMealPreferencesService, SyncStudentBookingsService],
})
export class DefaultPreferencesModule {}
