import { Injectable } from '@nestjs/common';
import { type StaffUser } from '@ennel/shared';
import { TransactionRunner } from '../../../../infrastructure/database/transaction-runner';
import { StaffSessionsService } from '../../admin-auth/services/staff-sessions.service';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { StaffPermissionsService } from '../../rbac/services/staff-permissions.service';
import {
  assertNotSelf,
  assertSuperAdminRemains,
  isSuperAdmin,
} from '../domain/staff-account-rules';
import { StaffUsersRepository } from '../repositories/staff-users.repository';
import { requireManageableStaff, requireStaff } from './staff-lookup';

export interface ChangeStaffStatusCommand {
  actorId: string;
  staffId: string;
  isEnabled: boolean;
  reason: string;
}

/**
 * Disable or re-enable a staff account. Disabling ends every session immediately; enabling
 * also clears a login lockout.
 */
@Injectable()
export class ChangeStaffStatusService {
  constructor(
    private readonly staff: StaffUsersRepository,
    private readonly sessions: StaffSessionsService,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly permissions: StaffPermissionsService,
  ) {}

  async execute(command: ChangeStaffStatusCommand): Promise<StaffUser> {
    const updated = await this.transactions.run(async (tx) => {
      const before = await requireManageableStaff(this.staff, command.actorId, command.staffId, tx);
      if (!command.isEnabled) {
        assertNotSelf(command.actorId, command.staffId, 'disable');
        if (isSuperAdmin(before.roles)) {
          assertSuperAdminRemains(await this.staff.countActiveSuperAdmins(tx, command.staffId));
        }
        await this.sessions.revokeAllWithin(tx, command.staffId);
      }
      const status = command.isEnabled ? 'ACTIVE' : 'DISABLED';
      await this.staff.setStatus(command.staffId, status, tx);
      await this.audit.write(tx, {
        action: command.isEnabled ? 'staff.enable' : 'staff.disable',
        entityType: 'staff_user',
        entityId: command.staffId,
        before: { status: before.status },
        after: { status },
        reason: command.reason,
      });
      return requireStaff(this.staff, command.staffId, tx);
    });
    this.permissions.invalidate(command.staffId);
    return updated;
  }
}
