import { Injectable } from '@nestjs/common';
import {
  type AdminStudentDetail,
  type AdminStudentListItem,
  MealType,
  normalizeReferenceNumber,
  type Paginated,
} from '@ennel/shared';
import { type Prisma, type StudentStatus } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../../infrastructure/database/transaction-runner';

export interface AdminStudentFilter {
  q?: string;
  hostelId?: string;
  hostelBlockId?: string;
  academicYear?: number;
  department?: string;
  registration?: 'REGISTERED' | 'UNREGISTERED';
  status?: StudentStatus;
  defaultBooking?: 'ON' | 'OFF';
}

export interface RosterChanges {
  fullName?: string;
  department?: string;
  academicYear?: number;
  hostelBlockId?: string | null;
  roomNumber?: string | null;
  email?: string | null;
}

export interface RosterTarget {
  rosterEntryId: string;
  studentId: string | null;
  studentStatus: StudentStatus | null;
  isRosterActive: boolean;
  version: number;
  snapshot: RosterChanges & { referenceNumber: string };
}

const LIST_INCLUDE = {
  hostelBlock: { select: { name: true, hostel: { select: { name: true } } } },
  student: {
    select: {
      id: true,
      status: true,
      defaultBookingEnabled: true,
      fullName: true,
      hostelBlockId: true,
      roomNumber: true,
      hostelBlock: { select: { name: true, hostel: { select: { name: true } } } },
    },
  },
} satisfies Prisma.CollegeRosterEntryInclude;
type ListRow = Prisma.CollegeRosterEntryGetPayload<{ include: typeof LIST_INCLUDE }>;

/** Registered students show their own (possibly edited) hostel details; others show the roster's. */
function toListItem(row: ListRow): AdminStudentListItem {
  const block = row.student ? row.student.hostelBlock : row.hostelBlock;
  return {
    rosterEntryId: row.id,
    studentId: row.student?.id ?? null,
    referenceNumber: row.referenceNumber,
    fullName: row.fullName,
    department: row.department,
    academicYear: row.academicYear,
    hostelBlockId: row.student ? row.student.hostelBlockId : row.hostelBlockId,
    hostelName: block?.hostel.name ?? null,
    blockName: block?.name ?? null,
    roomNumber: row.student ? row.student.roomNumber : row.roomNumber,
    isRegistered: row.student !== null,
    isRosterActive: row.isActive,
    status: row.student?.status ?? null,
    defaultBookingEnabled: row.student?.defaultBookingEnabled ?? null,
  };
}

function hostelCondition(
  filter: AdminStudentFilter,
): Prisma.CollegeRosterEntryWhereInput | undefined {
  const block = filter.hostelBlockId
    ? { hostelBlockId: filter.hostelBlockId }
    : filter.hostelId
      ? { hostelBlock: { hostelId: filter.hostelId } }
      : null;
  if (!block) return undefined;
  return { OR: [{ student: { is: block } }, { student: { is: null }, ...block }] };
}

function toWhere(filter: AdminStudentFilter): Prisma.CollegeRosterEntryWhereInput {
  const student: Prisma.StudentWhereInput = {
    status: filter.status,
    defaultBookingEnabled: filter.defaultBooking ? filter.defaultBooking === 'ON' : undefined,
  };
  const needsStudent =
    filter.registration === 'REGISTERED' || filter.status || filter.defaultBooking;
  const reference = filter.q ? normalizeReferenceNumber(filter.q) : '';
  return {
    AND: [
      hostelCondition(filter) ?? {},
      filter.registration === 'UNREGISTERED' ? { student: { is: null } } : {},
      needsStudent ? { student: { is: student } } : {},
      filter.q
        ? {
            OR: [
              { fullName: { contains: filter.q, mode: 'insensitive' } },
              ...(/^\d+$/.test(reference) ? [{ referenceNumber: { startsWith: reference } }] : []),
            ],
          }
        : {},
    ],
    academicYear: filter.academicYear,
    department: filter.department ? { equals: filter.department, mode: 'insensitive' } : undefined,
  };
}

export abstract class AdminStudentsRepository {
  abstract list(
    filter: AdminStudentFilter,
    page: number,
    pageSize: number,
  ): Promise<Paginated<AdminStudentListItem>>;
  abstract findDetail(
    rosterEntryId: string,
    noShowSince: Date,
  ): Promise<Omit<AdminStudentDetail, 'noShowWindowDays'> | null>;
  abstract findTarget(rosterEntryId: string, tx?: TransactionClient): Promise<RosterTarget | null>;
  abstract updateRoster(
    target: RosterTarget,
    version: number,
    changes: RosterChanges,
    tx: TransactionClient,
  ): Promise<boolean>;
  abstract setStudentStatus(
    studentId: string,
    status: StudentStatus,
    tx: TransactionClient,
  ): Promise<void>;
  abstract setRosterActive(
    rosterEntryId: string,
    isActive: boolean,
    tx: TransactionClient,
  ): Promise<void>;
  abstract setHostelBlock(
    rosterEntryIds: string[],
    hostelBlockId: string,
    tx: TransactionClient,
  ): Promise<number>;
  abstract isActiveHostelBlock(hostelBlockId: string): Promise<boolean>;
}

@Injectable()
export class PrismaAdminStudentsRepository extends AdminStudentsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async list(
    filter: AdminStudentFilter,
    page: number,
    pageSize: number,
  ): Promise<Paginated<AdminStudentListItem>> {
    const where = toWhere(filter);
    const [rows, total] = await Promise.all([
      this.prisma.collegeRosterEntry.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: [{ fullName: 'asc' }, { referenceNumber: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.collegeRosterEntry.count({ where }),
    ]);
    return { items: rows.map(toListItem), total, page, pageSize };
  }

  async findDetail(
    rosterEntryId: string,
    noShowSince: Date,
  ): Promise<Omit<AdminStudentDetail, 'noShowWindowDays'> | null> {
    const row = await this.prisma.collegeRosterEntry.findUnique({
      where: { id: rosterEntryId },
      include: LIST_INCLUDE,
    });
    if (!row) return null;
    const base = toListItem(row);
    const studentId = row.student?.id;
    const student = studentId
      ? await this.prisma.student.findUnique({ where: { id: studentId } })
      : null;
    const [preferences, recentBookings, leaves, noShowCounts, complaintsCount] = studentId
      ? await Promise.all([
          this.preferences(studentId),
          this.recentBookings(studentId),
          this.leaves(studentId),
          this.noShowCounts(studentId, noShowSince),
          this.prisma.complaint.count({ where: { studentId } }),
        ])
      : [[], [], [], emptyCounts(), 0];
    return {
      ...base,
      email: student?.email ?? row.email,
      phone: student?.phone ?? null,
      parentPhone: student?.parentPhone ?? null,
      registeredAt: student?.createdAt.toISOString() ?? null,
      onboardingCompletedAt: student?.onboardingCompletedAt?.toISOString() ?? null,
      lockedUntil: student?.lockedUntil?.toISOString() ?? null,
      preferences,
      recentBookings,
      leaves,
      noShowCounts,
      complaintsCount,
      rosterVersion: row.version,
    };
  }

  private async preferences(studentId: string): Promise<AdminStudentDetail['preferences']> {
    const rows = await this.prisma.mealPreference.findMany({
      where: { studentId },
      include: { meal: { select: { mealType: true } }, slot: { select: { label: true } } },
    });
    return rows.map((row) => ({
      mealType: row.meal.mealType,
      isEnabled: row.isEnabled,
      slotLabel: row.slot?.label ?? null,
      dietType: row.dietType,
      isAutoDisabled: row.autoDisabledAt !== null,
    }));
  }

  private async recentBookings(studentId: string): Promise<AdminStudentDetail['recentBookings']> {
    const rows = await this.prisma.booking.findMany({
      where: { studentId },
      orderBy: [{ mealDate: 'desc' }, { createdAt: 'desc' }],
      take: 20,
      include: { meal: { select: { mealType: true } }, slot: { select: { label: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      mealDate: row.mealDate.toISOString().slice(0, 10),
      mealType: row.meal.mealType,
      slotLabel: row.slot.label,
      status: row.status,
      source: row.source,
    }));
  }

  private async leaves(studentId: string): Promise<AdminStudentDetail['leaves']> {
    const rows = await this.prisma.leave.findMany({
      where: { studentId },
      orderBy: { startDate: 'desc' },
      take: 10,
    });
    return rows.map((row) => ({
      id: row.id,
      startDate: row.startDate.toISOString().slice(0, 10),
      startMealType: row.startMealType,
      endDate: row.endDate.toISOString().slice(0, 10),
      endMealType: row.endMealType,
      status: row.status,
    }));
  }

  private async noShowCounts(studentId: string, since: Date): Promise<Record<MealType, number>> {
    const groups = await this.prisma.noShowEvent.groupBy({
      by: ['mealType'],
      where: { studentId, status: 'COUNTED', mealDate: { gte: since } },
      _count: { _all: true },
    });
    const counts = emptyCounts();
    for (const group of groups) counts[group.mealType] = group._count._all;
    return counts;
  }

  async findTarget(
    rosterEntryId: string,
    tx: TransactionClient = this.prisma,
  ): Promise<RosterTarget | null> {
    const row = await tx.collegeRosterEntry.findUnique({
      where: { id: rosterEntryId },
      include: { student: { select: { id: true, status: true } } },
    });
    if (!row) return null;
    return {
      rosterEntryId: row.id,
      studentId: row.student?.id ?? null,
      studentStatus: row.student?.status ?? null,
      isRosterActive: row.isActive,
      version: row.version,
      snapshot: {
        referenceNumber: row.referenceNumber,
        fullName: row.fullName,
        department: row.department,
        academicYear: row.academicYear,
        hostelBlockId: row.hostelBlockId,
        roomNumber: row.roomNumber,
        email: row.email,
      },
    };
  }

  /** Corrections apply to the roster and to the student's own record, which students see. */
  async updateRoster(
    target: RosterTarget,
    version: number,
    changes: RosterChanges,
    tx: TransactionClient,
  ): Promise<boolean> {
    const result = await tx.collegeRosterEntry.updateMany({
      where: { id: target.rosterEntryId, version },
      data: { ...changes, version: { increment: 1 } },
    });
    if (result.count !== 1) return false;
    if (target.studentId) {
      await tx.student.update({
        where: { id: target.studentId },
        data: { ...changes, version: { increment: 1 } },
      });
    }
    return true;
  }

  async setStudentStatus(
    studentId: string,
    status: StudentStatus,
    tx: TransactionClient,
  ): Promise<void> {
    await tx.student.update({
      where: { id: studentId },
      data: { status, failedLoginCount: 0, lockedUntil: null, version: { increment: 1 } },
    });
  }

  async setRosterActive(
    rosterEntryId: string,
    isActive: boolean,
    tx: TransactionClient,
  ): Promise<void> {
    await tx.collegeRosterEntry.update({
      where: { id: rosterEntryId },
      data: { isActive, version: { increment: 1 } },
    });
  }

  async setHostelBlock(
    rosterEntryIds: string[],
    hostelBlockId: string,
    tx: TransactionClient,
  ): Promise<number> {
    const result = await tx.collegeRosterEntry.updateMany({
      where: { id: { in: rosterEntryIds } },
      data: { hostelBlockId, version: { increment: 1 } },
    });
    await tx.student.updateMany({
      where: { rosterEntryId: { in: rosterEntryIds } },
      data: { hostelBlockId, version: { increment: 1 } },
    });
    return result.count;
  }

  async isActiveHostelBlock(hostelBlockId: string): Promise<boolean> {
    const count = await this.prisma.hostelBlock.count({
      where: { id: hostelBlockId, isActive: true, hostel: { isActive: true } },
    });
    return count > 0;
  }
}

function emptyCounts(): Record<MealType, number> {
  return { [MealType.BREAKFAST]: 0, [MealType.LUNCH]: 0, [MealType.DINNER]: 0 };
}
