import { Injectable } from '@nestjs/common';
import { type AuditLogItem, type Paginated } from '@ennel/shared';
import { type ActorType, Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../../infrastructure/database/transaction-runner';

export interface AuditLogRow {
  actorId: string | null;
  actorType: ActorType;
  actorRoles: string[];
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  reason: string | null;
  isOverride: boolean;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

export interface AuditLogFilter {
  actorId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  from?: string;
  to?: string;
  isOverride?: boolean;
}

export abstract class AuditLogRepository {
  abstract insert(row: AuditLogRow, tx: TransactionClient): Promise<void>;
  abstract list(
    filter: AuditLogFilter,
    page: number,
    pageSize: number,
  ): Promise<Paginated<AuditLogItem>>;
}

function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === undefined || value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

function toWhere(filter: AuditLogFilter): Prisma.AuditLogWhereInput {
  return {
    actorId: filter.actorId,
    entityType: filter.entityType,
    entityId: filter.entityId,
    action: filter.action ? { startsWith: filter.action } : undefined,
    isOverride: filter.isOverride,
    createdAt: {
      gte: filter.from ? new Date(filter.from) : undefined,
      lte: filter.to ? new Date(filter.to) : undefined,
    },
  };
}

@Injectable()
export class PrismaAuditLogRepository extends AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async insert(row: AuditLogRow, tx: TransactionClient): Promise<void> {
    await tx.auditLog.create({
      data: { ...row, before: toJson(row.before), after: toJson(row.after) },
    });
  }

  async list(
    filter: AuditLogFilter,
    page: number,
    pageSize: number,
  ): Promise<Paginated<AuditLogItem>> {
    const where = toWhere(filter);
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    const actorNames = await this.findActorNames(rows.map((row) => row.actorId));
    const items = rows.map((row) => ({
      ...row,
      actorName: row.actorId ? (actorNames.get(row.actorId) ?? null) : null,
      createdAt: row.createdAt.toISOString(),
    }));
    return { items, total, page, pageSize };
  }

  // audit_logs has no FK to staff (it must outlive staff records), so names are looked up.
  private async findActorNames(ids: (string | null)[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => id !== null))];
    if (unique.length === 0) return new Map();
    const staff = await this.prisma.staffUser.findMany({
      where: { id: { in: unique } },
      select: { id: true, fullName: true },
    });
    return new Map(staff.map((member) => [member.id, member.fullName]));
  }
}
