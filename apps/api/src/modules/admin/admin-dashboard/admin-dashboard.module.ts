import { Module } from '@nestjs/common';
import { MessConfigModule } from '../../mess-config/mess-config.module';
import { SlotsModule } from '../../slots/slots.module';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { AdminDashboardRepository } from './repositories/admin-dashboard.repository';
import { GetDashboardService } from './services/get-dashboard.service';
import { GetPendingWorkService } from './services/get-pending-work.service';

/** Live dashboard (Admin §C). */
@Module({
  imports: [MessConfigModule, SlotsModule],
  controllers: [AdminDashboardController],
  providers: [AdminDashboardRepository, GetDashboardService, GetPendingWorkService],
})
export class AdminDashboardModule {}
