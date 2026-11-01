import { Injectable } from '@nestjs/common';
import {
  type AdminStudentDetail,
  type AdminStudentListItem,
  MealType,
  normalizeReferenceNumber,
  type Paginated,
} from '@ennel/shared';
import { type Prisma, type StudentStatus } from '../../../../generated/prisma/client';
import { type MealDefaultState, mealDefaultStates } from '../domain/meal-default-state';
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
  atNoShowWarning?: boolean;
  onLeave?: boolean;
}

/** Dates and policy numbers the No-show and leave columns are computed against. */
export interface ListContext {
  noShowSince: Date;
  today: Date;
  warningThreshold: number;
}

interface ListExtras {
  mealDefaults: Record<MealType, MealDefaultState> | null;
  noShowCounts: Record<MealType, number> | null;
  isOnLeaveToday: boolean;
}

const NO_EXTRAS: ListExtras = { mealDefaults: null, noShowCounts: null, isOnLeaveToday: false };

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
function toListItem(row: ListRow, extras: ListExtras = NO_EXTRAS): AdminStudentListItem {
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
    ...extras,
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

function toWhere(
  filter: AdminStudentFilter,
  context: ListContext,
  warnedStudentIds: string[] | null,
): Prisma.CollegeRosterEntryWhereInput {
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
      warnedStudentIds ? { student: { is: { id: { in: warnedStudentIds } } } } : {},
      filter.onLeave ? { student: { is: { leaves: { some: coveringToday(context) } } } } : {},
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

function coveringToday(context: ListContext): Prisma.LeaveWhereInput {
  return { status: 'APPROVED', startDate: { lte: context.today }, endDate: { gte: context.today } };
}

export abstract class AdminStudentsRepository {
  abstract list(
    filter: AdminStudentFilter,
    context: ListContext,
    page: number,
    pageSize: number,
  ): Promise<Paginated<AdminStudentListItem>>;
  abstract findDetail(
    rosterEntryId: string,
    context: ListContext,
  ): Promise<Omit<AdminStudentDetail, 'noShowWindowDays' | 'noShowDisableThreshold'> | null>;
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
    context: ListContext,
    page: number,
    pageSize: number,
  ): Promise<Paginated<AdminStudentListItem>> {
    const warned = filter.atNoShowWarning ? await this.warnedStudentIds(context) : null;
    const where = toWhere(filter, context, warned);
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
    const extras = await this.listExtras(rows, context);
    const items = rows.map((row) =>
      toListItem(row, (row.student && extras.get(row.student.id)) || NO_EXTRAS),
    );
    return { items, total, page, pageSize };
  }

  /** BR-NS-4: students with any meal at or above the warning threshold in the window. */
  private async warnedStudentIds(context: ListContext): Promise<string[]> {
    const groups = await this.prisma.noShowEvent.groupBy({
      by: ['studentId', 'mealType'],
      where: { status: 'COUNTED', mealDate: { gte: context.noShowSince } },
      having: { studentId: { _count: { gte: context.warningThreshold } } },
    });
    return [...new Set(groups.map((group) => group.studentId))];
  }

  /** The per-meal and leave columns for one page of rows, in three batched queries. */
  private async listExtras(
    rows: ListRow[],
    context: ListContext,
  ): Promise<Map<string, ListExtras>> {
    const students = rows.flatMap((row) => (row.student ? [row.student] : []));
    const ids = students.map((student) => student.id);
    if (ids.length === 0) return new Map();
    const [preferences, groups, leaves] = await Promise.all([
      this.prisma.mealPreference.findMany({
        where: { studentId: { in: ids } },
        select: {
          studentId: true,
          isEnabled: true,
          autoDisabledAt: true,
          meal: { select: { mealType: true } },
        },
      }),
      this.prisma.noShowEvent.groupBy({
        by: ['studentId', 'mealType'],
        where: {
          studentId: { in: ids },
          status: 'COUNTED',
          mealDate: { gte: context.noShowSince },
        },
        _count: { _all: true },
      }),
      this.prisma.leave.findMany({
        where: { studentId: { in: ids }, ...coveringToday(context) },
        select: { studentId: true },
      }),
    ]);
    const onLeave = new Set(leaves.map((leave) => leave.studentId));
    const extras = new Map<string, ListExtras>();
    for (const student of students) {
      const counts = emptyCounts();
      for (const group of groups) {
        if (group.studentId === student.id) counts[group.mealType] = group._count._all;
      }
      const flags = preferences
        .filter((preference) => preference.studentId === student.id)
        .map((preference) => ({
          mealType: preference.meal.mealType,
          isEnabled: preference.isEnabled,
          isAutoDisabled: preference.autoDisabledAt !== null,
        }));
      extras.set(student.id, {
        mealDefaults: mealDefaultStates(student.defaultBookingEnabled, flags),
        noShowCounts: counts,
        isOnLeaveToday: onLeave.has(student.id),
      });
    }
    return extras;
  }

  async findDetail(
    rosterEntryId: string,
    context: ListContext,
  ): Promise<Omit<AdminStudentDetail, 'noShowWindowDays' | 'noShowDisableThreshold'> | null> {
    const row = await this.prisma.collegeRosterEntry.findUnique({
      where: { id: rosterEntryId },
      include: LIST_INCLUDE,
    });
    if (!row) return null;
    const extras = (await this.listExtras([row], context)).get(row.student?.id ?? '') ?? NO_EXTRAS;
    const base = toListItem(row, extras);
    const studentId = row.student?.id;
    const student = studentId
      ? await this.prisma.student.findUnique({ where: { id: studentId } })
      : null;
    const [preferences, recentBookings, leaves, complaintsCount] = studentId
      ? await Promise.all([
          this.preferences(studentId),
          this.recentBookings(studentId),
          this.leaves(studentId),
          this.prisma.complaint.count({ where: { studentId } }),
        ])
      : [[], [], [], 0];
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
      noShowCounts: extras.noShowCounts ?? emptyCounts(),
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

  async findTarget(
    rosterEntryId: string,
    tx: TransactionClient = this.prisma,
  ): Promise<RosterTarget | null> {
    const row = await tx.collegeRosterEntry.findUnique({
      where: { id: rosterEntryId },
      include: {
        student: {
          select: { id: true, status: true, hostelBlockId: true, roomNumber: true, email: true },
        },
      },
    });
    if (!row) return null;
    // A registered student may have edited hostel, room and email (BR-AUTH-7); those are the
    // values staff see and replace, so the audit "before" must show them, not the roster's.
    const editable = row.student ?? row;
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
        hostelBlockId: editable.hostelBlockId,
        roomNumber: editable.roomNumber,
        email: editable.email,
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
