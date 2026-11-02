import { Module } from '@nestjs/common';
import { ReportExporter } from '../../../common/files/report-exporter';
import { MessConfigModule } from '../../mess-config/mess-config.module';
import { AdminDashboardModule } from '../admin-dashboard/admin-dashboard.module';
import { AdminForecastingController } from './controllers/admin-forecasting.controller';
import { AdminForecastingRepository } from './repositories/admin-forecasting.repository';
import { GetForecastService } from './services/get-forecast.service';

/** Kitchen demand forecasting (Admin §N, Phase 11). */
@Module({
  imports: [MessConfigModule, AdminDashboardModule],
  controllers: [AdminForecastingController],
  providers: [AdminForecastingRepository, GetForecastService, ReportExporter],
})
export class AdminForecastingModule {}
