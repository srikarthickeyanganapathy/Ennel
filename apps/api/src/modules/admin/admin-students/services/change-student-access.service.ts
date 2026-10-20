import { Injectable } from '@nestjs/common';
import { type AdminStudentDetail } from '@ennel/shared';
import { TransactionRunner } from '../../../../infrastructure/database/transaction-runner';
import { StudentSessionsAdminService } from '../../../auth/services/student-sessions-admin.service';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { decideAccessChange, type StudentAccessAction } from '../domain/student-access';
import { AdminStudentsRepository } from '../repositories/admin-students.repository';
import { requireRosterTarget } from './admin-student-lookup';
import { ListAdminStudentsService } from './list-admin-students.service';

export interface ChangeStudentAccessCommand {
  rosterEntryId: string;
  action: StudentAccessAction;
  reason: string;
}

const AUDIT_ACTIONS: Record<StudentAccessAction, string> = {
  LOCK: 'student.lock',
  UNLOCK: 'student.unlock',
  DEACTIVATE: 'student.deactivate',
  REACTIVATE: 'student.reactivate',
};

/** Lock/unlock and deactivate/reactivate a student (Admin §G), audited with a reason. */
@Injectable()
export class ChangeStudentAccessService {
  constructor(
    private readonly students: AdminStudentsRepository,
    private readonly studentSessions: StudentSessionsAdminService,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly getStudent: ListAdminStudentsService,
  ) {}

  async execute(command: ChangeStudentAccessCommand): Promise<AdminStudentDetail> {
    await this.transactions.run(async (tx) => {
      const target = await requireRosterTarget(this.students, command.rosterEntryId, tx);
      const change = decideAccessChange(
        {
          isRegistered: target.studentId !== null,
          status: target.studentStatus,
          isRosterActive: target.isRosterActive,
        },
        command.action,
      );
      if (target.studentId && change.studentStatus) {
        await this.students.setStudentStatus(target.studentId, change.studentStatus, tx);
      }
      if (change.isRosterActive !== target.isRosterActive) {
        await this.students.setRosterActive(command.rosterEntryId, change.isRosterActive, tx);
      }
      if (target.studentId && change.shouldRevokeSessions) {
        await this.studentSessions.revokeAllWithin(tx, target.studentId);
      }
      await this.audit.write(tx, {
        action: AUDIT_ACTIONS[command.action],
        entityType: 'college_roster',
        entityId: command.rosterEntryId,
        before: { studentStatus: target.studentStatus, isRosterActive: target.isRosterActive },
        after: { studentStatus: change.studentStatus, isRosterActive: change.isRosterActive },
        reason: command.reason,
      });
    });
    return this.getStudent.detail(command.rosterEntryId);
  }
}
