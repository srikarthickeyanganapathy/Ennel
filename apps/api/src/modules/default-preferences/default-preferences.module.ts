import { Module } from '@nestjs/common';
import { MessConfigModule } from '../mess-config/mess-config.module';
import {
  MealPreferenceRepository,
  PrismaMealPreferenceRepository,
} from './repositories/meal-preference.repository';
import { SaveMealPreferencesService } from './services/save-meal-preferences.service';

/** Default Booking preferences. Student endpoints for the Default Booking page arrive in Phase 5. */
@Module({
  imports: [MessConfigModule],
  providers: [
    { provide: MealPreferenceRepository, useClass: PrismaMealPreferenceRepository },
    SaveMealPreferencesService,
  ],
  exports: [SaveMealPreferencesService],
})
export class DefaultPreferencesModule {}
