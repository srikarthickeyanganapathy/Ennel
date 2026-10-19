import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';

export interface NewStudentSession {
  studentId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  ip?: string;
  userAgent?: string;
}

export interface StoredStudentSession {
  id: string;
  studentId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
}

export abstract class StudentSessionRepository {
  abstract create(session: NewStudentSession, tx?: TransactionClient): Promise<{ id: string }>;
  abstract findByTokenHash(tokenHash: string): Promise<StoredStudentSession | null>;
  /** Returns false if the session was already rotated or revoked (a concurrent refresh). */
  abstract markReplaced(
    sessionId: string,
    replacedById: string,
    now: Date,
    tx?: TransactionClient,
  ): Promise<boolean>;
  abstract revokeFamily(familyId: string, now: Date): Promise<void>;
}

@Injectable()
export class PrismaStudentSessionRepository extends StudentSessionRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  create(session: NewStudentSession, tx: TransactionClient = this.prisma): Promise<{ id: string }> {
    return tx.studentSession.create({ data: session, select: { id: true } });
  }

  findByTokenHash(tokenHash: string): Promise<StoredStudentSession | null> {
    return this.prisma.studentSession.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        studentId: true,
        familyId: true,
        expiresAt: true,
        revokedAt: true,
        replacedById: true,
      },
    });
  }

  async markReplaced(
    sessionId: string,
    replacedById: string,
    now: Date,
    tx: TransactionClient = this.prisma,
  ): Promise<boolean> {
    const result = await tx.studentSession.updateMany({
      where: { id: sessionId, replacedById: null, revokedAt: null },
      data: { replacedById, lastUsedAt: now },
    });
    return result.count === 1;
  }

  async revokeFamily(familyId: string, now: Date): Promise<void> {
    await this.prisma.studentSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: now },
    });
  }
}
