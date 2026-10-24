import { Get, Query } from '@nestjs/common';
import { type Dashboard, dashboardQuerySchema } from '@ennel/shared';
import { type z } from 'zod';
import {
  AdminController,
  RequirePermissions,
} from '../../../../common/decorators/admin.decorators';
import {
  type AuthenticatedStaff,
  CurrentStaff,
} from '../../../../common/decorators/current-staff.decorator';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe';
import { GetDashboardService } from '../services/get-dashboard.service';

/** Admin §C. Other dates additionally need dashboard:read, checked in the service. */
@AdminController('dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboard: GetDashboardService) {}

  @Get()
  @RequirePermissions('dashboard:read-today')
  get(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Query(new ZodValidationPipe(dashboardQuerySchema))
    query: z.output<typeof dashboardQuerySchema>,
  ): Promise<Dashboard> {
    return this.dashboard.execute(staff.id, query.date);
  }
}
