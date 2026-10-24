import { Module } from '@nestjs/common';
import { BookingsModule } from '../../bookings/bookings.module';
import { MessConfigModule } from '../../mess-config/mess-config.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { AdminClosuresController } from './controllers/admin-closures.controller';
import { AdminClosuresRepository } from './repositories/admin-closures.repository';
import { ApplyClosureService } from './services/apply-closure.service';
import { ClosureQueriesService } from './services/closure-queries.service';
import { RemoveClosureService } from './services/remove-closure.service';

/** Closures (Admin §F, BR-CLOS, ADR-0017). */
@Module({
  imports: [BookingsModule, MessConfigModule, NotificationsModule],
  controllers: [AdminClosuresController],
  providers: [
    AdminClosuresRepository,
    ClosureQueriesService,
    ApplyClosureService,
    RemoveClosureService,
  ],
})
export class AdminClosuresModule {}
