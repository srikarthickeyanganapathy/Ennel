import { Injectable } from '@nestjs/common';
import { type CredentialResetKind } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';
import { type ResetTicketState } from '../domain/credential-reset';

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
  abstract recordFailure(ticketId: string): Promise<void>;
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

  async recordFailure(ticketId: string): Promise<void> {
    await this.prisma.credentialResetTicket.update({
      where: { id: ticketId },
      data: { failedAttempts: { increment: 1 } },
    });
  }

  /** Conditional so a code can only be redeemed once even under concurrent requests. */
  async markUsed(ticketId: string, now: Date, tx: TransactionClient): Promise<boolean> {
    const result = await tx.credentialResetTicket.updateMany({
      where: { id: ticketId, usedAt: null, invalidatedAt: null },
      data: { usedAt: now },
    });
    return result.count === 1;
  }
}
