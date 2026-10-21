import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  type MessPolicyView,
  type Paginated,
  type PolicyHistoryItem,
} from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';
import {
  type TransactionClient,
  TransactionRunner,
} from '../../../../infrastructure/database/transaction-runner';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { diffPolicy, findPolicyProblems } from '../domain/policy-rules';
import { AdminPolicyRepository, type PolicyChanges } from '../repositories/admin-policy.repository';
import { staleVersion } from './config-errors';

export interface PolicyUpdateCommand {
  changes: PolicyChanges;
  version: number;
  reason: string;
  staffId: string;
  /** Audit action, so threshold edits from mess configuration are distinguishable. */
  action: 'policy.update' | 'policy.thresholds.update';
}

/**
 * Policy settings with explanations, version checks and change history (Admin §D, Rule 8).
 * Every saved change records both a history row and an audit entry in one transaction.
 */
@Injectable()
export class PolicySettingsService {
  constructor(
    private readonly policies: AdminPolicyRepository,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
  ) {}

  get(): Promise<MessPolicyView> {
    return this.policies.get();
  }

  history(page: number, pageSize: number): Promise<Paginated<PolicyHistoryItem>> {
    return this.policies.listHistory(page, pageSize);
  }

  update(command: PolicyUpdateCommand): Promise<MessPolicyView> {
    return this.transactions.run(async (tx) => {
      const current = await this.policies.get(tx);
      // Checked first: comparing against a colleague's newer values could otherwise report
      // "Nothing changed" or validate against settings the editor never saw (BR-ADM-2).
      if (current.version !== command.version) throw staleVersion('policy');
      const { before, after } = diffPolicy(current, command.changes);
      if (Object.keys(after).length === 0) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, 'Nothing changed.');
      }
      const problems = findPolicyProblems({ ...current, ...after });
      if (problems.length > 0) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, problems[0]?.message ?? 'Invalid policy', {
          issues: problems,
        });
      }
      if (!(await this.policies.update(command.version, after, command.staffId, tx)))
        throw staleVersion('policy');
      await this.record(command, before, after, tx);
      return this.policies.get(tx);
    });
  }

  private async record(
    command: PolicyUpdateCommand,
    before: object,
    after: object,
    tx: TransactionClient,
  ): Promise<void> {
    await this.policies.addHistory(
      {
        version: command.version + 1,
        before: before as Record<string, unknown>,
        after: after as Record<string, unknown>,
        reason: command.reason,
        changedById: command.staffId,
      },
      tx,
    );
    await this.audit.write(tx, {
      action: command.action,
      entityType: 'mess_policy',
      entityId: '1',
      before,
      after,
      reason: command.reason,
    });
  }
}
