import { Injectable } from '@nestjs/common';
import { type AdminStudentDetail, ErrorCode } from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';
import { TransactionRunner } from '../../../../infrastructure/database/transaction-runner';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import {
  AdminStudentsRepository,
  type RosterChanges,
} from '../repositories/admin-students.repository';
import { assertActiveBlock, requireRosterTarget } from './admin-student-lookup';
import { ListAdminStudentsService } from './list-admin-students.service';

export interface UpdateAdminStudentCommand {
  rosterEntryId: string;
  changes: RosterChanges;
  reason: string;
  rosterVersion: number;
}

/** Staff correction of college-controlled fields (Admin §G), with a reason and version check. */
@Injectable()
export class UpdateAdminStudentService {
  constructor(
    private readonly students: AdminStudentsRepository,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly getStudent: ListAdminStudentsService,
  ) {}

  async execute(command: UpdateAdminStudentCommand): Promise<AdminStudentDetail> {
    const changes = Object.fromEntries(
      Object.entries(command.changes).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(changes).length === 0) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, 'Change at least one field.');
    }
    await assertActiveBlock(this.students, command.changes.hostelBlockId);
    await this.transactions.run(async (tx) => {
      const target = await requireRosterTarget(this.students, command.rosterEntryId, tx);
      if (!(await this.students.updateRoster(target, command.rosterVersion, changes, tx))) {
        throw new AppError(
          ErrorCode.VERSION_CONFLICT,
          'Someone else changed this student. Reload and try again.',
        );
      }
      const before = Object.fromEntries(
        Object.keys(changes).map((key) => [key, target.snapshot[key as keyof RosterChanges]]),
      );
      await this.audit.write(tx, {
        action: 'student.update',
        entityType: 'college_roster',
        entityId: command.rosterEntryId,
        before,
        after: changes,
        reason: command.reason,
      });
    });
    return this.getStudent.detail(command.rosterEntryId);
  }
}
