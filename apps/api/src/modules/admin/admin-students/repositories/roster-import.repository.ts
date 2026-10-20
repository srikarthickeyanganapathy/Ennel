import { Injectable } from '@nestjs/common';
import {
  type Paginated,
  ROSTER_ROW_OUTCOMES,
  type RosterImportRow,
  type RosterImportSummary,
  type RosterRowOutcome,
  BLOCKING_ROSTER_OUTCOMES,
} from '@ennel/shared';
import { type Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../../infrastructure/database/transaction-runner';
import { blockKey, type ClassifiedRow, type ExistingRosterEntry } from '../domain/roster-import';

export interface NewRosterImport {
  id: string;
  fileName: string;
  storageKey: string;
  createdById: string;
  rows: ClassifiedRow[];
}

export interface StoredImportRow {
  rowNumber: number;
  raw: Record<string, string>;
}

export interface RosterUpsert {
  referenceNumber: string;
  fullName: string;
  department: string;
  academicYear: number;
  hostelBlockId: string | null;
  roomNumber: string | null;
  email: string | null;
}

export abstract class RosterImportRepository {
  abstract loadExisting(
    referenceNumbers: string[],
    tx?: TransactionClient,
  ): Promise<Map<string, ExistingRosterEntry>>;
  abstract loadBlocks(tx?: TransactionClient): Promise<Map<string, string>>;
  abstract create(job: NewRosterImport, tx: TransactionClient): Promise<void>;
  abstract findSummary(id: string): Promise<RosterImportSummary | null>;
  abstract listJobs(page: number, pageSize: number): Promise<Paginated<RosterImportSummary>>;
  abstract listRows(
    id: string,
    outcome: RosterRowOutcome | undefined,
    page: number,
    pageSize: number,
  ): Promise<Paginated<RosterImportRow>>;
  abstract claimForConfirm(
    id: string,
    now: Date,
    tx: TransactionClient,
  ): Promise<StoredImportRow[] | null>;
  abstract upsertEntries(
    entries: RosterUpsert[],
    jobId: string,
    controlledFields: readonly string[],
    tx: TransactionClient,
  ): Promise<void>;
  abstract complete(id: string, now: Date, tx: TransactionClient): Promise<void>;
}

const JOB_INCLUDE = { createdBy: { select: { fullName: true } } } satisfies Prisma.ImportJobInclude;
type JobRow = Prisma.ImportJobGetPayload<{ include: typeof JOB_INCLUDE }>;

function toSummary(job: JobRow, counts: Record<RosterRowOutcome, number>): RosterImportSummary {
  const blocking = BLOCKING_ROSTER_OUTCOMES.reduce((sum, outcome) => sum + counts[outcome], 0);
  return {
    id: job.id,
    status: job.status,
    fileName: job.fileName,
    totalRows: job.totalRows,
    counts,
    canConfirm: job.status === 'VALIDATED' && blocking === 0 && job.totalRows > 0,
    createdAt: job.createdAt.toISOString(),
    createdByName: job.createdBy.fullName,
    confirmedAt: job.confirmedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
  };
}

function zeroCounts(): Record<RosterRowOutcome, number> {
  return Object.fromEntries(ROSTER_ROW_OUTCOMES.map((outcome) => [outcome, 0])) as Record<
    RosterRowOutcome,
    number
  >;
}

interface StoredRowDetails {
  issues: { field: string; message: string }[];
  changes: string[];
}

@Injectable()
export class PrismaRosterImportRepository extends RosterImportRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async loadExisting(
    referenceNumbers: string[],
    tx: TransactionClient = this.prisma,
  ): Promise<Map<string, ExistingRosterEntry>> {
    const rows = await tx.collegeRosterEntry.findMany({
      where: { referenceNumber: { in: referenceNumbers } },
    });
    return new Map(
      rows.map((row) => [
        row.referenceNumber,
        {
          fullName: row.fullName,
          department: row.department,
          academicYear: row.academicYear,
          hostelBlockId: row.hostelBlockId,
          roomNumber: row.roomNumber,
          email: row.email,
        },
      ]),
    );
  }

  async loadBlocks(tx: TransactionClient = this.prisma): Promise<Map<string, string>> {
    const blocks = await tx.hostelBlock.findMany({
      where: { isActive: true, hostel: { isActive: true } },
      include: { hostel: { select: { name: true } } },
    });
    return new Map(blocks.map((block) => [blockKey(block.hostel.name, block.name), block.id]));
  }

  async create(job: NewRosterImport, tx: TransactionClient): Promise<void> {
    const blocking = job.rows.filter((row) =>
      BLOCKING_ROSTER_OUTCOMES.includes(row.outcome),
    ).length;
    await tx.importJob.create({
      data: {
        id: job.id,
        type: 'ROSTER',
        status: 'VALIDATED',
        fileName: job.fileName,
        storageKey: job.storageKey,
        totalRows: job.rows.length,
        validRows: job.rows.length - blocking,
        invalidRows: blocking,
        createdById: job.createdById,
      },
    });
    await tx.importJobRow.createMany({
      data: job.rows.map((row) => ({
        importJobId: job.id,
        rowNumber: row.rowNumber,
        raw: row.raw,
        outcome: row.outcome,
        errors: {
          issues: row.errors,
          changes: row.changes,
        } satisfies StoredRowDetails as unknown as Prisma.InputJsonValue,
      })),
    });
  }

  async findSummary(id: string): Promise<RosterImportSummary | null> {
    const job = await this.prisma.importJob.findFirst({
      where: { id, type: 'ROSTER' },
      include: JOB_INCLUDE,
    });
    return job ? toSummary(job, await this.countOutcomes(id)) : null;
  }

  async listJobs(page: number, pageSize: number): Promise<Paginated<RosterImportSummary>> {
    const where = { type: 'ROSTER' as const };
    const [jobs, total] = await Promise.all([
      this.prisma.importJob.findMany({
        where,
        include: JOB_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.importJob.count({ where }),
    ]);
    const items = await Promise.all(
      jobs.map(async (job) => toSummary(job, await this.countOutcomes(job.id))),
    );
    return { items, total, page, pageSize };
  }

  private async countOutcomes(id: string): Promise<Record<RosterRowOutcome, number>> {
    const groups = await this.prisma.importJobRow.groupBy({
      by: ['outcome'],
      where: { importJobId: id },
      _count: { _all: true },
    });
    const counts = zeroCounts();
    for (const group of groups) counts[group.outcome] = group._count._all;
    return counts;
  }

  async listRows(
    id: string,
    outcome: RosterRowOutcome | undefined,
    page: number,
    pageSize: number,
  ): Promise<Paginated<RosterImportRow>> {
    const where = { importJobId: id, outcome };
    const [rows, total] = await Promise.all([
      this.prisma.importJobRow.findMany({
        where,
        orderBy: { rowNumber: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.importJobRow.count({ where }),
    ]);
    const items = rows.map((row) => {
      const details = (row.errors ?? { issues: [], changes: [] }) as unknown as StoredRowDetails;
      return {
        rowNumber: row.rowNumber,
        outcome: row.outcome,
        raw: row.raw as Record<string, string>,
        errors: details.issues,
        changes: details.changes,
      };
    });
    return { items, total, page, pageSize };
  }

  /** Moves VALIDATED → PROCESSING exactly once, so a double confirm cannot apply twice. */
  async claimForConfirm(
    id: string,
    now: Date,
    tx: TransactionClient,
  ): Promise<StoredImportRow[] | null> {
    const claimed = await tx.importJob.updateMany({
      where: { id, type: 'ROSTER', status: 'VALIDATED' },
      data: { status: 'PROCESSING', confirmedAt: now },
    });
    if (claimed.count !== 1) return null;
    const rows = await tx.importJobRow.findMany({
      where: { importJobId: id },
      orderBy: { rowNumber: 'asc' },
    });
    return rows.map((row) => ({
      rowNumber: row.rowNumber,
      raw: row.raw as Record<string, string>,
    }));
  }

  /**
   * Creates or updates roster entries. For registered students the college-controlled fields
   * are copied to their own record too (ADR-0018); student-editable fields are left alone.
   */
  async upsertEntries(
    entries: RosterUpsert[],
    jobId: string,
    controlledFields: readonly string[],
    tx: TransactionClient,
  ): Promise<void> {
    for (const entry of entries) {
      const { referenceNumber, ...fields } = entry;
      const saved = await tx.collegeRosterEntry.upsert({
        where: { referenceNumber },
        create: { ...entry, lastImportJobId: jobId },
        update: { ...fields, lastImportJobId: jobId, version: { increment: 1 } },
        select: { id: true },
      });
      const controlled = Object.fromEntries(
        Object.entries(fields).filter(([key]) => controlledFields.includes(key)),
      );
      if (Object.keys(controlled).length > 0) {
        await tx.student.updateMany({ where: { rosterEntryId: saved.id }, data: controlled });
      }
    }
  }

  async complete(id: string, now: Date, tx: TransactionClient): Promise<void> {
    await tx.importJob.update({ where: { id }, data: { status: 'COMPLETED', completedAt: now } });
  }
}
