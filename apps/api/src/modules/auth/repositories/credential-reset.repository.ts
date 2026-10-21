import { Injectable } from '@nestjs/common';
import { type CredentialResetKind } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';
import { RESET_CODE_MAX_ATTEMPTS, type ResetTicketState } from '../domain/credential-reset';

export interface NewResetTicket {
  studentId: string;
  kind: CredentialResetKind;
  codeHash: string;
  reason: string;
  expiresAt: Date;
  issuedById: string;
}

export interface StoredResetTicket extends ResetTicketState {
  id: string;
  kind: CredentialResetKind;
  codeHash: string;
}

export abstract class CredentialResetRepository {
  abstract invalidateOpen(studentId: string, now: Date, tx: TransactionClient): Promise<void>;
  abstract create(ticket: NewResetTicket, tx: TransactionClient): Promise<string>;
  abstract findLatest(studentId: string): Promise<StoredResetTicket | null>;
  /** Reserves one of the ticket's attempts; false when none are left or it is no longer usable. */
  abstract claimAttempt(ticketId: string, now: Date): Promise<boolean>;
  abstract markUsed(ticketId: string, now: Date, tx: TransactionClient): Promise<boolean>;
}

@Injectable()
export class PrismaCredentialResetRepository extends CredentialResetRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async invalidateOpen(studentId: string, now: Date, tx: TransactionClient): Promise<void> {
    await tx.credentialResetTicket.updateMany({
      where: { studentId, usedAt: null, invalidatedAt: null },
      data: { invalidatedAt: now },
    });
  }

  async create(ticket: NewResetTicket, tx: TransactionClient): Promise<string> {
    const created = await tx.credentialResetTicket.create({ data: ticket, select: { id: true } });
    return created.id;
  }

  findLatest(studentId: string): Promise<StoredResetTicket | null> {
    return this.prisma.credentialResetTicket.findFirst({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        kind: true,
        codeHash: true,
        expiresAt: true,
        usedAt: true,
        invalidatedAt: true,
        failedAttempts: true,
      },
    });
  }

  /**
   * Counts the attempt before the code is checked, in one conditional statement, so parallel
   * guesses cannot all pass a stale "attempts left" check (ADR-0019: 5 attempts per code).
   */
  async claimAttempt(ticketId: string, now: Date): Promise<boolean> {
    const result = await this.prisma.credentialResetTicket.updateMany({
      where: {
        id: ticketId,
        usedAt: null,
        invalidatedAt: null,
        expiresAt: { gt: now },
        failedAttempts: { lt: RESET_CODE_MAX_ATTEMPTS },
      },
      data: { failedAttempts: { increment: 1 } },
    });
    return result.count === 1;
  }

  /**
   * Conditional so a code can only be redeemed once even under concurrent requests. The
   * successful attempt claimed by `claimAttempt` is not a failure, so it is given back.
   */
  async markUsed(ticketId: string, now: Date, tx: TransactionClient): Promise<boolean> {
    const result = await tx.credentialResetTicket.updateMany({
      where: { id: ticketId, usedAt: null, invalidatedAt: null },
      data: { usedAt: now, failedAttempts: { decrement: 1 } },
    });
    return result.count === 1;
  }
}
