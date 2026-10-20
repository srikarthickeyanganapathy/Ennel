import { Injectable } from '@nestjs/common';
import { type CredentialResetIssued, ErrorCode } from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';
import { TransactionRunner } from '../../../../infrastructure/database/transaction-runner';
import { IssueCredentialResetService } from '../../../auth/services/issue-credential-reset.service';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { AdminStudentsRepository } from '../repositories/admin-students.repository';
import { requireRosterTarget } from './admin-student-lookup';

export interface IssueStudentResetCommand {
  rosterEntryId: string;
  kind: 'PASSWORD' | 'REGISTRATION';
  reason: string;
  staffId: string;
}

/**
 * Admin §G "reset registration or password": generates a one-time code, never a password
 * (ADR-0019). The code is not written to the audit log.
 */
@Injectable()
export class IssueStudentResetService {
  constructor(
    private readonly students: AdminStudentsRepository,
    private readonly resets: IssueCredentialResetService,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
  ) {}

  execute(command: IssueStudentResetCommand): Promise<CredentialResetIssued> {
    return this.transactions.run(async (tx) => {
      const target = await requireRosterTarget(this.students, command.rosterEntryId, tx);
      if (!target.studentId) {
        throw new AppError(
          ErrorCode.VALIDATION_FAILED,
          'This student has not registered yet, so there is nothing to reset.',
        );
      }
      const issued = await this.resets.issueWithin(tx, {
        studentId: target.studentId,
        kind: command.kind,
        reason: command.reason,
        issuedById: command.staffId,
      });
      await this.audit.write(tx, {
        action: `student.reset-${command.kind.toLowerCase()}.issue`,
        entityType: 'college_roster',
        entityId: command.rosterEntryId,
        after: { kind: command.kind, expiresAt: issued.expiresAt },
        reason: command.reason,
      });
      return issued;
    });
  }
}
