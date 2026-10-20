import { Injectable } from '@nestjs/common';
import { type StaffSessionItem } from '@ennel/shared';
import { Clock } from '../../../../infrastructure/clock/clock';
import {
  type TransactionClient,
  TransactionRunner,
} from '../../../../infrastructure/database/transaction-runner';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { StaffSessionRepository } from '../repositories/staff-session.repository';

/** Admin §B session list and "log out everywhere". */
@Injectable()
export class StaffSessionsService {
  constructor(
    private readonly sessions: StaffSessionRepository,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly clock: Clock,
  ) {}

  async list(staffId: string, currentSessionId: string | null): Promise<StaffSessionItem[]> {
    const current = currentSessionId ? await this.sessions.findById(currentSessionId) : null;
    const active = await this.sessions.listActive(staffId, this.clock.now());
    return active.map((session) => ({
      id: session.id,
      createdAt: session.createdAt.toISOString(),
      lastUsedAt: session.lastUsedAt?.toISOString() ?? null,
      ip: session.ip,
      userAgent: session.userAgent,
      isCurrent: current?.familyId === session.familyId,
    }));
  }

  async revokeAll(staffId: string): Promise<void> {
    await this.transactions.run(async (tx) => {
      const count = await this.sessions.revokeAllForStaff(staffId, this.clock.now(), tx);
      await this.audit.write(tx, {
        action: 'staff.sessions.revoke-all',
        entityType: 'staff_user',
        entityId: staffId,
        after: { revokedSessions: count },
      });
    });
  }

  /** Ends every session inside a caller's transaction, e.g. when an account is disabled. */
  revokeAllWithin(tx: TransactionClient, staffId: string): Promise<number> {
    return this.sessions.revokeAllForStaff(staffId, this.clock.now(), tx);
  }
}
