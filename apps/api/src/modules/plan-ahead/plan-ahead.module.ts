import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DefaultPreferencesModule } from '../default-preferences/default-preferences.module';
import { MessConfigModule } from '../mess-config/mess-config.module';
import { WeekdayRulesController } from './controllers/weekday-rules.controller';
import { WeekdayRulesRepository } from './repositories/weekday-rules.repository';
import { WeekdayRulesService } from './services/weekday-rules.service';

/**
 * Plan Ahead (Spec §6, Phase 6). One-day changes reuse the booking commands from Home; this
 * module owns the recurring weekday rules.
 */
@Module({
  imports: [AuthModule, MessConfigModule, DefaultPreferencesModule],
  controllers: [WeekdayRulesController],
  providers: [WeekdayRulesRepository, WeekdayRulesService],
})
export class PlanAheadModule {}
