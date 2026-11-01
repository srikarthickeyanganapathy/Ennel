import { Injectable } from '@nestjs/common';
import {
  type adminComplaintListQuerySchema,
  type BusinessDate,
  type ComplaintCategory,
  type ComplaintPrivacyMode,
  type ComplaintStatus,
  type ComplaintType,
  type MealType,
} from '@ennel/shared';
import { type z } from 'zod';
import { type Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';

type AdminListQuery = z.output<typeof adminComplaintListQuerySchema>;

const toDbDate = (date: BusinessDate) => new Date(`${date}T00:00:00Z`);
const fromDbDate = (date: Date): BusinessDate => date.toISOString().slice(0, 10);
/** End of an IST business day, as an instant, for `createdAt` ranges. */
const endOfDay = (date: BusinessDate) => new Date(`${date}T23:59:59.999+05:30`);
const startOfDay = (date: BusinessDate) => new Date(`${date}T00:00:00+05:30`);

export interface NewComplaint {
  referenceCode: string;
  studentId: string | null;
  hostelBlockId: string | null;
  privacyMode: ComplaintPrivacyMode;
  submitterTokenHash: string | null;
  type: ComplaintType;
  category: ComplaintCategory;
  mealType: MealType | null;
  mealDate: BusinessDate | null;
  description: string;
}

export interface NewComplaintPhoto {
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
}

const COMPLAINT_INCLUDE = {
  student: {
    select: {
      id: true,
      fullName: true,
      rosterEntry: { select: { referenceNumber: true } },
      hostelBlock: { select: { name: true } },
    },
  },
  assignedTo: { select: { id: true, fullName: true } },
  _count: { select: { photos: true } },
} as const;
type ComplaintWithRelations = Prisma.ComplaintGetPayload<{ include: typeof COMPLAINT_INCLUDE }>;

export interface ComplaintRow {
  id: string;
  referenceCode: string;
  type: ComplaintType;
  category: ComplaintCategory;
  mealType: MealType | null;
  mealDate: BusinessDate | null;
  description: string;
  status: ComplaintStatus;
  response: string | null;
  privacyMode: ComplaintPrivacyMode;
  studentId: string | null;
  submitter: {
    id: string;
    fullName: string;
    referenceNumber: string;
    blockName: string | null;
  } | null;
  assignedTo: { id: string; fullName: string } | null;
  photoCount: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}

export interface ComplaintChange {
  status?: ComplaintStatus;
  studentResponse?: string;
  resolvedAt?: Date;
  assignedToId?: string | null;
}

/** Complaints, photos, notes and status history (Spec §12, Admin §L). */
@Injectable()
export class ComplaintsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(complaint: NewComplaint, tx: TransactionClient): Promise<string> {
    const { mealDate, ...rest } = complaint;
    const row = await tx.complaint.create({
      data: { ...rest, mealDate: mealDate ? toDbDate(mealDate) : null },
      select: { id: true },
    });
    return row.id;
  }

  async addPhotos(
    complaintId: string,
    photos: readonly NewComplaintPhoto[],
    tx: TransactionClient,
  ): Promise<void> {
    if (photos.length === 0) return;
    await tx.complaintPhoto.createMany({
      data: photos.map((photo) => ({ ...photo, complaintId })),
    });
  }

  async addHistory(
    entry: {
      complaintId: string;
      fromStatus: ComplaintStatus | null;
      toStatus: ComplaintStatus;
      actorId: string | null;
    },
    tx: TransactionClient,
  ): Promise<void> {
    await tx.complaintStatusHistory.create({ data: entry });
  }

  async find(id: string, tx: TransactionClient = this.prisma): Promise<ComplaintRow | null> {
    const row = await tx.complaint.findUnique({ where: { id }, include: COMPLAINT_INCLUDE });
    return row ? toRow(row) : null;
  }

  async listForStudent(studentId: string): Promise<ComplaintRow[]> {
    const rows = await this.prisma.complaint.findMany({
      where: { studentId },
      include: COMPLAINT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map(toRow);
  }

  async listByTokenHashes(hashes: readonly string[]): Promise<ComplaintRow[]> {
    const rows = await this.prisma.complaint.findMany({
      where: { submitterTokenHash: { in: [...hashes] } },
      include: COMPLAINT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toRow);
  }

  async list(
    query: AdminListQuery,
    staffId: string,
  ): Promise<{ rows: ComplaintRow[]; total: number }> {
    const where = buildWhere(query, staffId);
    const [rows, total] = await Promise.all([
      this.prisma.complaint.findMany({
        where,
        include: COMPLAINT_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.complaint.count({ where }),
    ]);
    return { rows: rows.map(toRow), total };
  }

  /** Version-checked update (Admin UX "optimistic locking"); false when a colleague changed it. */
  async update(
    id: string,
    version: number,
    change: ComplaintChange,
    tx: TransactionClient,
  ): Promise<boolean> {
    const result = await tx.complaint.updateMany({
      where: { id, version },
      data: { ...change, version: { increment: 1 } },
    });
    return result.count === 1;
  }

  photos(complaintId: string): Promise<{ id: string; storageKey: string }[]> {
    return this.prisma.complaintPhoto.findMany({
      where: { complaintId },
      select: { id: true, storageKey: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async notes(
    complaintId: string,
  ): Promise<{ id: string; body: string; authorName: string; createdAt: Date }[]> {
    const rows = await this.prisma.complaintNote.findMany({
      where: { complaintId },
      select: { id: true, body: true, createdAt: true, author: { select: { fullName: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(({ author, ...note }) => ({ ...note, authorName: author.fullName }));
  }

  async addNote(
    note: { complaintId: string; authorId: string; body: string },
    tx: TransactionClient,
  ): Promise<string> {
    const row = await tx.complaintNote.create({ data: note, select: { id: true } });
    return row.id;
  }

  async history(complaintId: string): Promise<
    {
      fromStatus: ComplaintStatus | null;
      toStatus: ComplaintStatus;
      actorName: string | null;
      createdAt: Date;
    }[]
  > {
    const rows = await this.prisma.complaintStatusHistory.findMany({
      where: { complaintId },
      select: {
        fromStatus: true,
        toStatus: true,
        createdAt: true,
        actor: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(({ actor, ...entry }) => ({ ...entry, actorName: actor?.fullName ?? null }));
  }

  /** Grouped counts for the analytics view; uses the (category, meal, date) index. */
  async analytics(
    from: BusinessDate,
    to: BusinessDate,
  ): Promise<{
    byCategory: { category: ComplaintCategory; count: number }[];
    byMeal: { mealType: MealType | null; count: number }[];
    byStatus: { status: ComplaintStatus; count: number }[];
    closed: { createdAt: Date; resolvedAt: Date | null }[];
  }> {
    const where = { createdAt: { gte: startOfDay(from), lte: endOfDay(to) } };
    const [byCategory, byMeal, byStatus, closed] = await Promise.all([
      this.prisma.complaint.groupBy({ by: ['category'], where, _count: { _all: true } }),
      this.prisma.complaint.groupBy({ by: ['mealType'], where, _count: { _all: true } }),
      this.prisma.complaint.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.complaint.findMany({
        where: { ...where, resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
      }),
    ]);
    return {
      byCategory: byCategory.map((row) => ({ category: row.category, count: row._count._all })),
      byMeal: byMeal.map((row) => ({ mealType: row.mealType, count: row._count._all })),
      byStatus: byStatus.map((row) => ({ status: row.status, count: row._count._all })),
      closed,
    };
  }

  /** Active staff who hold a role with `complaints:resolve`. */
  assignees(): Promise<{ id: string; fullName: string }[]> {
    return this.prisma.staffUser.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        roles: {
          some: { role: { permissions: { some: { permissionKey: 'complaints:resolve' } } } },
        },
      },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    });
  }

  submitter(studentId: string): Promise<{ id: string; hostelBlockId: string | null } | null> {
    return this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, hostelBlockId: true },
    });
  }
}

function buildWhere(query: AdminListQuery, staffId: string): Prisma.ComplaintWhereInput {
  return {
    ...(query.type && { type: query.type }),
    ...(query.category && { category: query.category }),
    ...(query.mealType && { mealType: query.mealType }),
    ...(query.status && { status: query.status }),
    ...(query.hostelBlockId && { hostelBlockId: query.hostelBlockId }),
    ...(query.assignedToMe && { assignedToId: staffId }),
    ...((query.from || query.to) && {
      createdAt: {
        ...(query.from && { gte: startOfDay(query.from) }),
        ...(query.to && { lte: endOfDay(query.to) }),
      },
    }),
  };
}

function toRow(row: ComplaintWithRelations): ComplaintRow {
  const student = row.student;
  return {
    id: row.id,
    referenceCode: row.referenceCode,
    type: row.type,
    category: row.category,
    mealType: row.mealType,
    mealDate: row.mealDate ? fromDbDate(row.mealDate) : null,
    description: row.description,
    status: row.status,
    response: row.studentResponse,
    privacyMode: row.privacyMode,
    studentId: row.studentId,
    // Anonymous rows have no student, so identity can never be returned (BR-CMP-2).
    submitter: student && {
      id: student.id,
      fullName: student.fullName,
      referenceNumber: student.rosterEntry.referenceNumber,
      blockName: student.hostelBlock?.name ?? null,
    },
    assignedTo: row.assignedTo,
    photoCount: row._count.photos,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt,
  };
}
