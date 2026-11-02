import { Body, Get, HttpCode, Param, Post } from '@nestjs/common';
import { runJobRequestSchema, type SystemHealth } from '@ennel/shared';
import { type z } from 'zod';
import {
  AdminController,
  RequirePermissions,
} from '../../../../common/decorators/admin.decorators';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe';
import { SystemHealthService } from '../services/system-health.service';

/** System health (Admin §Q). */
@AdminController('system')
export class AdminSystemController {
  constructor(private readonly system: SystemHealthService) {}

  @Get('health')
  @RequirePermissions('system:read')
  health(): Promise<SystemHealth> {
    return this.system.health();
  }

  @Post('jobs/:name/run')
  @HttpCode(202)
  @RequirePermissions('system:manage')
  async run(
    @Param('name') name: string,
    @Body(new ZodValidationPipe(runJobRequestSchema)) body: z.output<typeof runJobRequestSchema>,
  ): Promise<{ queued: true }> {
    await this.system.runNow(name, body.reason);
    return { queued: true };
  }
}
