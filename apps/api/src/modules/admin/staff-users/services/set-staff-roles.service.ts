import { Injectable } from '@nestjs/common';
import { type StaffRole, type StaffUser } from '@ennel/shared';
import { TransactionRunner } from '../../../../infrastructure/database/transaction-runner';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { StaffPermissionsService } from '../../rbac/services/staff-permissions.service';
import {
  assertNotSelf,
  assertSuperAdminRemains,
  isSuperAdmin,
} from '../domain/staff-account-rules';
import { StaffUsersRepository } from '../repositories/staff-users.repository';
import { requireStaff, versionConflict } from './staff-lookup';

export interface SetStaffRolesCommand {
  actorId: string;
  staffId: string;
  roles: StaffRole[];
  reason: string;
  version: number;
}

/** Role assignment; only Super Admins hold roles:manage by default (Admin §A). */
@Injectable()
export class SetStaffRolesService {
  constructor(
    private readonly staff: StaffUsersRepository,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly permissions: StaffPermissionsService,
  ) {}

  async execute(command: SetStaffRolesCommand): Promise<StaffUser> {
    const updated = await this.transactions.run(async (tx) => {
      const before = await requireStaff(this.staff, command.staffId, tx);
      if (isSuperAdmin(before.roles) && !isSuperAdmin(command.roles)) {
        assertNotSelf(command.actorId, command.staffId, 'remove Super Admin from');
        const others = await this.staff.countActiveSuperAdmins(tx, command.staffId);
        assertSuperAdminRemains(others);
      }
      if (!(await this.staff.setRoles(command.staffId, command.version, command.roles, tx))) {
        throw versionConflict();
      }
      await this.audit.write(tx, {
        action: 'staff.roles.set',
        entityType: 'staff_user',
        entityId: command.staffId,
        before: { roles: before.roles },
        after: { roles: command.roles },
        reason: command.reason,
      });
      return requireStaff(this.staff, command.staffId, tx);
    });
    this.permissions.invalidate(command.staffId);
    return updated;
  }
}
