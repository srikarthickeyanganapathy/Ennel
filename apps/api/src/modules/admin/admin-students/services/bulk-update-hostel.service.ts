import { Injectable } from '@nestjs/common';
import { TransactionRunner } from '../../../../infrastructure/database/transaction-runner';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { AdminStudentsRepository } from '../repositories/admin-students.repository';
import { assertActiveBlock } from './admin-student-lookup';

export interface BulkUpdateHostelCommand {
  rosterEntryIds: string[];
  hostelBlockId: string;
  reason: string;
}

/** Admin §G bulk hostel update: one transaction, one audit entry listing the students moved. */
@Injectable()
export class BulkUpdateHostelService {
  constructor(
    private readonly students: AdminStudentsRepository,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
  ) {}

  async execute(command: BulkUpdateHostelCommand): Promise<{ updated: number }> {
    await assertActiveBlock(this.students, command.hostelBlockId);
    const ids = [...new Set(command.rosterEntryIds)];
    return this.transactions.run(async (tx) => {
      const updated = await this.students.setHostelBlock(ids, command.hostelBlockId, tx);
      await this.audit.write(tx, {
        action: 'student.bulk-hostel',
        entityType: 'college_roster',
        entityId: 'bulk',
        after: { hostelBlockId: command.hostelBlockId, rosterEntryIds: ids, updated },
        reason: command.reason,
      });
      return { updated };
    });
  }
}
