import { Injectable } from '@nestjs/common';
import { type MessPolicyView, type Paginated, type PolicyHistoryItem } from '@ennel/shared';
import { type Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../../infrastructure/database/transaction-runner';

const POLICY_ROW_ID = 1;
export type PolicyChanges = Partial<
  Omit<MessPolicyView, 'version' | 'updatedAt' | 'updatedByName'>
>;

export interface PolicyHistoryEntry {
  version: number;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  reason: string;
  changedById: string;
}

/** Write side of `mess_policy` with optimistic locking and change history (Admin §D). */
@Injectable()
export class AdminPolicyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async get(tx: TransactionClient = this.prisma): Promise<MessPolicyView> {
    await tx.messPolicy.upsert({
      where: { id: POLICY_ROW_ID },
      create: { id: POLICY_ROW_ID },
      update: {},
    });
    const row = await tx.messPolicy.findUniqueOrThrow({
      where: { id: POLICY_ROW_ID },
      include: { updatedBy: { select: { fullName: true } } },
    });
    const {
      id: _id,
      updatedById: _updatedById,
      updatedBy,
      updatedAt,
      collegeControlledFields,
      ...policy
    } = row;
    return {
      ...policy,
      collegeControlledFields: collegeControlledFields as MessPolicyView['collegeControlledFields'],
      updatedAt: updatedAt.toISOString(),
      updatedByName: updatedBy?.fullName ?? null,
    };
  }

  async update(
    version: number,
    changes: PolicyChanges,
    staffId: string,
    tx: TransactionClient,
  ): Promise<boolean> {
    const result = await tx.messPolicy.updateMany({
      where: { id: POLICY_ROW_ID, version },
      data: { ...changes, updatedById: staffId, version: { increment: 1 } },
    });
    return result.count === 1;
  }

  async addHistory(entry: PolicyHistoryEntry, tx: TransactionClient): Promise<void> {
    await tx.messPolicyHistory.create({
      data: {
        ...entry,
        before: entry.before as Prisma.InputJsonValue,
        after: entry.after as Prisma.InputJsonValue,
      },
    });
  }

  async listHistory(page: number, pageSize: number): Promise<Paginated<PolicyHistoryItem>> {
    const [rows, total] = await Promise.all([
      this.prisma.messPolicyHistory.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { changedBy: { select: { fullName: true } } },
      }),
      this.prisma.messPolicyHistory.count(),
    ]);
    const items = rows.map((row) => ({
      id: row.id,
      version: row.version,
      before: row.before as Record<string, unknown>,
      after: row.after as Record<string, unknown>,
      reason: row.reason,
      changedByName: row.changedBy.fullName,
      createdAt: row.createdAt.toISOString(),
    }));
    return { items, total, page, pageSize };
  }
}
