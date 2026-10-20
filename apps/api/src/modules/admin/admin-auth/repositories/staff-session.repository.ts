import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../../infrastructure/database/transaction-runner';

export interface NewStaffSession {
  id: string;
  staffUserId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  ip?: string;
  userAgent?: string;
}

export interface StoredStaffSession {
  id: string;
  staffUserId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
}

export interface ActiveStaffSession {
  id: string;
  familyId: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  ip: string | null;
  userAgent: string | null;
}

export abstract class StaffSessionRepository {
  abstract create(session: NewStaffSession, tx?: TransactionClient): Promise<void>;
  abstract findByTokenHash(tokenHash: string): Promise<StoredStaffSession | null>;
  abstract findById(sessionId: string): Promise<StoredStaffSession | null>;
  abstract markReplaced(
    sessionId: string,
    replacedById: string,
    now: Date,
    tx: TransactionClient,
  ): Promise<boolean>;
  abstract revokeFamily(familyId: string, now: Date): Promise<void>;
  abstract revokeAllForStaff(staffId: string, now: Date, tx?: TransactionClient): Promise<number>;
  abstract listActive(staffId: string, now: Date): Promise<ActiveStaffSession[]>;
}

const STORED_SELECT = {
  id: true,
  staffUserId: true,
  familyId: true,
  expiresAt: true,
  revokedAt: true,
  replacedById: true,
} as const;

@Injectable()
export class PrismaStaffSessionRepository extends StaffSessionRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(session: NewStaffSession, tx: TransactionClient = this.prisma): Promise<void> {
    await tx.staffSession.create({ data: session });
  }

  findByTokenHash(tokenHash: string): Promise<StoredStaffSession | null> {
    return this.prisma.staffSession.findUnique({ where: { tokenHash }, select: STORED_SELECT });
  }

  findById(sessionId: string): Promise<StoredStaffSession | null> {
    return this.prisma.staffSession.findUnique({ where: { id: sessionId }, select: STORED_SELECT });
  }

  async markReplaced(
    sessionId: string,
    replacedById: string,
    now: Date,
    tx: TransactionClient,
  ): Promise<boolean> {
    const result = await tx.staffSession.updateMany({
      where: { id: sessionId, replacedById: null, revokedAt: null },
      data: { replacedById, lastUsedAt: now },
    });
    return result.count === 1;
  }

  async revokeFamily(familyId: string, now: Date): Promise<void> {
    await this.prisma.staffSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  async revokeAllForStaff(
    staffId: string,
    now: Date,
    tx: TransactionClient = this.prisma,
  ): Promise<number> {
    const result = await tx.staffSession.updateMany({
      where: { staffUserId: staffId, revokedAt: null },
      data: { revokedAt: now },
    });
    return result.count;
  }

  /** The newest token of each live family is one signed-in device. */
  listActive(staffId: string, now: Date): Promise<ActiveStaffSession[]> {
    return this.prisma.staffSession.findMany({
      where: { staffUserId: staffId, revokedAt: null, replacedById: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        familyId: true,
        createdAt: true,
        lastUsedAt: true,
        ip: true,
        userAgent: true,
      },
    });
  }
}
