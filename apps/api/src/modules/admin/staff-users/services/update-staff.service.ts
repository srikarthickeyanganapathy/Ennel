import { Injectable } from '@nestjs/common';
import { type StaffUser } from '@ennel/shared';
import { TransactionRunner } from '../../../../infrastructure/database/transaction-runner';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { StaffUsersRepository } from '../repositories/staff-users.repository';
import { requireManageableStaff, requireStaff, versionConflict } from './staff-lookup';

/** Edits a staff member's name with a version check (Admin UX: no silent overwrites). */
@Injectable()
export class UpdateStaffService {
  constructor(
    private readonly staff: StaffUsersRepository,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
  ) {}

  execute(actorId: string, id: string, fullName: string, version: number): Promise<StaffUser> {
    return this.transactions.run(async (tx) => {
      const before = await requireManageableStaff(this.staff, actorId, id, tx);
      if (!(await this.staff.updateName(id, version, fullName, tx))) throw versionConflict();
      await this.audit.write(tx, {
        action: 'staff.update',
        entityType: 'staff_user',
        entityId: id,
        before: { fullName: before.fullName },
        after: { fullName },
      });
      return requireStaff(this.staff, id, tx);
    });
  }
}
