import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DefaultPreferencesModule } from '../default-preferences/default-preferences.module';
import { MessConfigModule } from '../mess-config/mess-config.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { NoShowsController } from './controllers/no-shows.controller';
import { NoShowsRepository } from './repositories/no-shows.repository';
import { NoShowEngine } from './services/no-show-engine.service';
import { StudentNoShowsService } from './services/student-no-shows.service';

/** The no-show engine and the student side of No-shows (Spec §10, Phase 9). */
@Module({
  imports: [AuthModule, DefaultPreferencesModule, MessConfigModule, NotificationsModule],
  controllers: [NoShowsController],
  providers: [NoShowsRepository, NoShowEngine, StudentNoShowsService],
  exports: [NoShowsRepository, NoShowEngine],
})
export class NoShowsModule {}
