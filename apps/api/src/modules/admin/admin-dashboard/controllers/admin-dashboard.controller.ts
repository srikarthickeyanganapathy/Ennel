import { Get, Query } from '@nestjs/common';
import { type Dashboard, dashboardQuerySchema, type PendingWork } from '@ennel/shared';
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
import { GetPendingWorkService } from '../services/get-pending-work.service';

/** Admin §C. Other dates additionally need dashboard:read, checked in the service. */
@AdminController('dashboard')
export class AdminDashboardController {
  constructor(
    private readonly dashboard: GetDashboardService,
    private readonly pendingWork: GetPendingWorkService,
  ) {}

  /** Counts for the sidebar badges (leave approvals, open complaints, No-show reviews). */
  @Get('pending')
  @RequirePermissions('dashboard:read-today')
  pending(): Promise<PendingWork> {
    return this.pendingWork.execute();
  }

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
