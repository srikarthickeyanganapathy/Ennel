import { Controller, Get, Inject } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';

export interface RootInfo {
  name: string;
  status: string;
  health: string;
  apiDocs: string;
  adminDashboard: string;
}

/**
 * Answers `GET /` (outside the /api/v1 prefix) so opening the API in a browser shows where to
 * go instead of a NOT_FOUND error. It exposes no data beyond public URLs.
 */
@ApiExcludeController()
@Controller()
export class RootController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  @Get()
  info(): RootInfo {
    return {
      name: 'ENNEL API',
      status: 'running',
      health: '/api/v1/health',
      apiDocs: '/api/docs',
      adminDashboard: this.config.adminWebOrigin,
    };
  }
}
