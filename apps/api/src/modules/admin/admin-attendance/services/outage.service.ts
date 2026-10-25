import { Injectable } from '@nestjs/common';
import { ErrorCode, type OutageStatus } from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';
import { Clock } from '../../../../infrastructure/clock/clock';
import { TransactionRunner } from '../../../../infrastructure/database/transaction-runner';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { AdminAttendanceRepository } from '../repositories/admin-attendance.repository';

/**
 * Admin §I outage mode, BR-NS-7: while it is on, manual marks are linked to the outage window and
 * No-shows for any meal window it overlaps are held for review instead of counted.
 */
@Injectable()
export class OutageService {
  constructor(
    private readonly admin: AdminAttendanceRepository,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly clock: Clock,
  ) {}

  async status(): Promise<OutageStatus> {
    return { active: await this.admin.activeOutage() };
  }

  async start(staffId: string, reason: string): Promise<OutageStatus> {
    await this.transactions.run(async (tx) => {
      await this.admin.lockOutage(tx);
      if (await this.admin.activeOutage(tx)) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, 'Outage mode is already on.');
      }
      const outage = await this.admin.startOutage(staffId, reason, this.clock.now(), tx);
      await this.audit.write(tx, {
        action: 'attendance.outage.start',
        entityType: 'attendance_outage_window',
        entityId: outage.id,
        after: { startedAt: outage.startedAt },
        reason,
      });
    });
    return this.status();
  }

  async end(staffId: string, reason: string): Promise<OutageStatus> {
    await this.transactions.run(async (tx) => {
      await this.admin.lockOutage(tx);
      const active = await this.admin.activeOutage(tx);
      if (!active) throw new AppError(ErrorCode.VALIDATION_FAILED, 'Outage mode is not on.');
      const now = this.clock.now();
      await this.admin.endOutage(active.id, staffId, now, tx);
      await this.audit.write(tx, {
        action: 'attendance.outage.end',
        entityType: 'attendance_outage_window',
        entityId: active.id,
        before: { startedAt: active.startedAt },
        after: { endedAt: now.toISOString() },
        reason,
      });
    });
    return this.status();
  }
}
