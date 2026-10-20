import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { type CredentialResetIssued } from '@ennel/shared';
import { hash } from 'argon2';
import { Clock } from '../../../infrastructure/clock/clock';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';
import { calculateTicketExpiry, formatResetCode } from '../domain/credential-reset';
import { CredentialResetRepository } from '../repositories/credential-reset.repository';

export interface IssueCredentialResetCommand {
  studentId: string;
  kind: 'PASSWORD' | 'REGISTRATION';
  reason: string;
  issuedById: string;
}

/**
 * Creates a one-time reset code (ADR-0019). Only the argon2 hash is stored and earlier unused
 * codes stop working. Runs in the staff use case's transaction, which writes the audit entry.
 */
@Injectable()
export class IssueCredentialResetService {
  constructor(
    private readonly tickets: CredentialResetRepository,
    private readonly clock: Clock,
  ) {}

  async issueWithin(
    tx: TransactionClient,
    command: IssueCredentialResetCommand,
  ): Promise<CredentialResetIssued> {
    const now = this.clock.now();
    const code = formatResetCode(randomBytes(16));
    const expiresAt = calculateTicketExpiry(now);
    await this.tickets.invalidateOpen(command.studentId, now, tx);
    await this.tickets.create({ ...command, codeHash: await hash(code), expiresAt }, tx);
    return { code, kind: command.kind, expiresAt: expiresAt.toISOString() };
  }
}
