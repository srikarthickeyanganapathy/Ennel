import { Get, Query, Res } from '@nestjs/common';
import { type Forecast, forecastExportQuerySchema, forecastQuerySchema } from '@ennel/shared';
import { type Response } from 'express';
import { type z } from 'zod';
import {
  AdminController,
  RequirePermissions,
} from '../../../../common/decorators/admin.decorators';
import { ReportExporter } from '../../../../common/files/report-exporter';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe';
import { kitchenSheet } from '../domain/kitchen-sheet';
import { GetForecastService } from '../services/get-forecast.service';

/** Kitchen demand forecasting (Admin §N). */
@AdminController('forecast')
export class AdminForecastingController {
  constructor(
    private readonly forecast: GetForecastService,
    private readonly exporter: ReportExporter,
  ) {}

  @Get()
  @RequirePermissions('forecasting:read')
  get(
    @Query(new ZodValidationPipe(forecastQuerySchema)) query: z.output<typeof forecastQuerySchema>,
  ): Promise<Forecast> {
    return this.forecast.execute(query.from, query.days);
  }

  @Get('export')
  @RequirePermissions('forecasting:export')
  async export(
    @Query(new ZodValidationPipe(forecastExportQuerySchema))
    query: z.output<typeof forecastExportQuerySchema>,
    @Res() response: Response,
  ): Promise<void> {
    const forecast = await this.forecast.execute(query.from, query.days);
    const file = await this.exporter.render(kitchenSheet(forecast), query.format);
    response
      .setHeader('Content-Type', file.contentType)
      .setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`)
      .send(file.data);
  }
}
