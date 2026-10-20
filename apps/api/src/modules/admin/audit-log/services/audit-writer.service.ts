import { Injectable } from '@nestjs/common';
import { getRequestContext } from '../../../../common/context/request-context';
import { toAuditSnapshot } from '../../../../common/utils/audit-snapshot';
import { type TransactionClient } from '../../../../infrastructure/database/transaction-runner';
import { AuditLogRepository } from '../repositories/audit-log.repository';

export interface AuditEntry {
  /** Dotted verb phrase, e.g. "staff.create" or "booking.override.cancel". */
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  isOverride?: boolean;
}

/**
 * The only writer of `audit_logs` (Admin §P). It requires the caller's transaction client, so
 * the entry commits or rolls back with the change it describes. Actor, IP, user agent and
 * request ID come from the request context; jobs without one are recorded as SYSTEM.
 */
@Injectable()
export class AuditWriter {
  constructor(private readonly repository: AuditLogRepository) {}

  async write(tx: TransactionClient, entry: AuditEntry): Promise<void> {
    const context = getRequestContext();
    const actor = context?.actor;
    await this.repository.insert(
      {
        actorId: actor?.type === 'STAFF' ? actor.id : null,
        actorType: actor?.type === 'STAFF' ? 'STAFF' : 'SYSTEM',
        actorRoles: actor?.roles ?? [],
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        before: toAuditSnapshot(entry.before),
        after: toAuditSnapshot(entry.after),
        reason: entry.reason ?? null,
        isOverride: entry.isOverride ?? false,
        ip: context?.ip ?? null,
        userAgent: context?.userAgent?.slice(0, 300) ?? null,
        requestId: context?.requestId ?? null,
      },
      tx,
    );
  }
}
