import { Injectable } from '@nestjs/common';
import { type PendingWork } from '@ennel/shared';
import { AdminDashboardRepository } from '../repositories/admin-dashboard.repository';

/**
 * Admin §C pending-work counts on their own, so the sidebar badges can refresh on every page
 * without computing the whole dashboard.
 */
@Injectable()
export class GetPendingWorkService {
  constructor(private readonly dashboard: AdminDashboardRepository) {}

  execute(): Promise<PendingWork> {
    return this.dashboard.pendingWork();
  }
}
