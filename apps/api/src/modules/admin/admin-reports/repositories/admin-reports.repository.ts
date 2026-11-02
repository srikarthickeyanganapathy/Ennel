import { Injectable } from '@nestjs/common';
import {
  addBusinessDays,
  BookingStatus,
  type BusinessDate,
  type ComplaintCategory,
  type ComplaintStatus,
  type ReportFilters,
  type ReportFormat,
  toInstant,
} from '@ennel/shared';
import { type Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../../infrastructure/database/transaction-runner';
import {
  type BookingCount,
  type CancelledBooking,
  type MealInfo,
  type SlotInfo,
} from '../domain/report-summary';

const toDbDate = (date: BusinessDate) => new Date(`${date}T00:00:00Z`);
const fromDbDate = (date: Date): BusinessDate => date.toISOString().slice(0, 10);

/** Statuses a report counts (ADR-0029); closures and leave are neither served nor wasted. */
const REPORTED_STATUSES = [
  BookingStatus.BOOKED,
  BookingStatus.COMPLETED,
  BookingStatus.NO_SHOW,
  BookingStatus.CANCELLED,
];

export interface HostelCount {
  hostelId: string | null;
  hostelName: string | null;
  status: string;
  count: number;
}

export interface ReportExportRow {
  id: string;
  requestedById: string;
  status: 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED';
  format: string;
  filters: Prisma.JsonValue;
  fileKey: string | null;
  fileName: string;
  error: string | null;
  createdAt: Date;
  finishedAt: Date | null;
}

/** Indexed aggregates behind the reports (Admin §O); nothing here returns a student's identity. */
@Injectable()
export class AdminReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async meals(): Promise<MealInfo[]> {
    const rows = await this.prisma.meal.findMany({
      where: { isActive: true },
      orderBy: { serviceStartMinute: 'asc' },
      select: { id: true, mealType: true, displayName: true },
    });
    return rows.map((row) => ({ id: row.id, mealType: row.mealType, mealName: row.displayName }));
  }

  hostels(): Promise<{ id: string; name: string }[]> {
    return this.prisma.hostel.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  private bookingWhere(
    from: BusinessDate,
    to: BusinessDate,
    filters: Pick<ReportFilters, 'hostelId'>,
    mealIds: readonly string[],
  ): Prisma.BookingWhereInput {
    return {
      mealDate: { gte: toDbDate(from), lte: toDbDate(to) },
      mealId: { in: [...mealIds] },
      ...(filters.hostelId && { student: { hostelBlock: { hostelId: filters.hostelId } } }),
    };
  }

  async bookingCounts(
    from: BusinessDate,
    to: BusinessDate,
    filters: Pick<ReportFilters, 'hostelId'>,
    mealIds: readonly string[],
  ): Promise<BookingCount[]> {
    const rows = await this.prisma.booking.groupBy({
      by: ['mealDate', 'mealId', 'slotId', 'status', 'isOverCapacity'],
      where: {
        ...this.bookingWhere(from, to, filters, mealIds),
        status: { in: REPORTED_STATUSES },
      },
      _count: { _all: true },
    });
    return rows.map((row) => ({
      date: fromDbDate(row.mealDate),
      mealId: row.mealId,
      slotId: row.slotId,
      status: row.status,
      isOverCapacity: row.isOverCapacity,
      count: row._count._all,
    }));
  }

  /** Grouped in SQL: Prisma's groupBy cannot reach through student to hostel. */
  async hostelCounts(
    from: BusinessDate,
    to: BusinessDate,
    filters: Pick<ReportFilters, 'hostelId'>,
    mealIds: readonly string[],
  ): Promise<HostelCount[]> {
    if (mealIds.length === 0) return [];
    const rows = await this.prisma.$queryRaw<
      { hostel_id: string | null; hostel_name: string | null; status: string; count: bigint }[]
    >`
      SELECT h.id AS hostel_id, h.name AS hostel_name, b.status::text AS status, COUNT(*) AS count
      FROM bookings b
      JOIN students s ON s.id = b.student_id
      LEFT JOIN hostel_blocks hb ON hb.id = s.hostel_block_id
      LEFT JOIN hostels h ON h.id = hb.hostel_id
      WHERE b.meal_date BETWEEN ${toDbDate(from)}::date AND ${toDbDate(to)}::date
        AND b.meal_id = ANY(${[...mealIds]}::uuid[])
        AND b.status::text IN ('COMPLETED', 'NO_SHOW')
        AND (${filters.hostelId ?? null}::uuid IS NULL OR h.id = ${filters.hostelId ?? null}::uuid)
      GROUP BY h.id, h.name, b.status
    `;
    return rows.map((row) => ({
      hostelId: row.hostel_id,
      hostelName: row.hostel_name,
      status: row.status,
      count: Number(row.count),
    }));
  }

  async cancelledBookings(
    from: BusinessDate,
    to: BusinessDate,
    filters: Pick<ReportFilters, 'hostelId'>,
    mealIds: readonly string[],
  ): Promise<CancelledBooking[]> {
    const rows = await this.prisma.booking.findMany({
      where: {
        ...this.bookingWhere(from, to, filters, mealIds),
        status: BookingStatus.CANCELLED,
        cancelledAt: { not: null },
      },
      select: { mealDate: true, cancelledAt: true, slot: { select: { startMinute: true } } },
    });
    return rows.flatMap((row) =>
      row.cancelledAt
        ? [
            {
              date: fromDbDate(row.mealDate),
              startMinute: row.slot.startMinute,
              cancelledAt: row.cancelledAt,
            },
          ]
        : [],
    );
  }

  async slots(
    from: BusinessDate,
    to: BusinessDate,
    meals: readonly MealInfo[],
  ): Promise<SlotInfo[]> {
    const rows = await this.prisma.mealSlot.findMany({
      where: { mealId: { in: meals.map((meal) => meal.id) }, deletedAt: null },
      orderBy: { startMinute: 'asc' },
      select: {
        id: true,
        mealId: true,
        label: true,
        startMinute: true,
        defaultCapacity: true,
        isActive: true,
        weekdayCapacities: { select: { weekday: true, capacity: true } },
        capacityOverrides: {
          where: { mealDate: { gte: toDbDate(from), lte: toDbDate(to) } },
          select: { mealDate: true, capacity: true },
        },
      },
    });
    const types = new Map(meals.map((meal) => [meal.id, meal.mealType]));
    return rows.flatMap((row) => {
      const mealType = types.get(row.mealId);
      return mealType
        ? [
            {
              slotId: row.id,
              mealId: row.mealId,
              mealType,
              label: row.label,
              startMinute: row.startMinute,
              defaultCapacity: row.defaultCapacity,
              weekdayCapacities: row.weekdayCapacities,
              dateCapacities: row.capacityOverrides.map((entry) => ({
                date: fromDbDate(entry.mealDate),
                capacity: entry.capacity,
              })),
            },
          ]
        : [];
    });
  }

  /** `mealId#date` of active closures in the range. */
  async closedMeals(from: BusinessDate, to: BusinessDate): Promise<Set<string>> {
    const rows = await this.prisma.messClosure.findMany({
      where: { status: 'ACTIVE', mealDate: { gte: toDbDate(from), lte: toDbDate(to) } },
      select: { mealDate: true, meals: { select: { mealId: true } } },
    });
    return new Set(
      rows.flatMap((row) => row.meals.map((meal) => `${meal.mealId}#${fromDbDate(row.mealDate)}`)),
    );
  }

  async leaveCounts(filters: ReportFilters): Promise<{ status: string; count: number }[]> {
    const rows = await this.prisma.leave.groupBy({
      by: ['status'],
      where: {
        startDate: { gte: toDbDate(filters.from), lte: toDbDate(filters.to) },
        ...(filters.hostelId && { student: { hostelBlock: { hostelId: filters.hostelId } } }),
      },
      _count: { _all: true },
    });
    return rows.map((row) => ({ status: row.status, count: row._count._all }));
  }

  private async complaintWhere(filters: ReportFilters): Promise<Prisma.ComplaintWhereInput> {
    // Anonymous complaints store no hostel (ADR-0008), so one hostel's view leaves them out.
    const blocks = filters.hostelId
      ? await this.prisma.hostelBlock.findMany({
          where: { hostelId: filters.hostelId },
          select: { id: true },
        })
      : null;
    return {
      createdAt: {
        gte: toInstant(filters.from, 0),
        lt: toInstant(addBusinessDays(filters.to, 1), 0),
      },
      ...(filters.mealType && { mealType: filters.mealType }),
      ...(blocks && { hostelBlockId: { in: blocks.map((block) => block.id) } }),
    };
  }

  async complaintCounts(filters: ReportFilters) {
    const where = await this.complaintWhere(filters);
    const [categories, statuses, resolved] = await Promise.all([
      this.prisma.complaint.groupBy({ by: ['category'], where, _count: { _all: true } }),
      this.prisma.complaint.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.complaint.findMany({
        where: { ...where, resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
      }),
    ]);
    return {
      byCategory: categories.map((row) => ({
        category: row.category as ComplaintCategory,
        count: row._count._all,
      })),
      byStatus: statuses.map((row) => ({
        status: row.status as ComplaintStatus,
        count: row._count._all,
      })),
      resolved: resolved.flatMap((row) =>
        row.resolvedAt ? [{ createdAt: row.createdAt, resolvedAt: row.resolvedAt }] : [],
      ),
    };
  }

  createExport(
    data: {
      requestedById: string;
      format: ReportFormat;
      filters: ReportFilters;
      fileName: string;
    },
    tx: TransactionClient,
  ): Promise<ReportExportRow> {
    return tx.reportExport.create({
      data: { ...data, filters: data.filters as unknown as Prisma.InputJsonValue },
    });
  }

  listExports(requestedById: string, take: number): Promise<ReportExportRow[]> {
    return this.prisma.reportExport.findMany({
      where: { requestedById },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  findExport(id: string, requestedById: string): Promise<ReportExportRow | null> {
    return this.prisma.reportExport.findFirst({ where: { id, requestedById } });
  }

  queuedExports(take: number): Promise<ReportExportRow[]> {
    return this.prisma.reportExport.findMany({
      where: { status: 'QUEUED' },
      orderBy: { createdAt: 'asc' },
      take,
    });
  }

  /** True only for the caller that moved it on, so two workers cannot both build one export. */
  async claimExport(id: string): Promise<boolean> {
    const { count } = await this.prisma.reportExport.updateMany({
      where: { id, status: 'QUEUED' },
      data: { status: 'RUNNING' },
    });
    return count === 1;
  }

  async finishExport(
    id: string,
    now: Date,
    result: { fileKey: string } | { error: string },
  ): Promise<void> {
    await this.prisma.reportExport.update({
      where: { id },
      data:
        'fileKey' in result
          ? { status: 'READY', fileKey: result.fileKey, finishedAt: now }
          : { status: 'FAILED', error: result.error, finishedAt: now },
    });
  }

  /** A worker that died leaves its export RUNNING; this lets staff see it failed and try again. */
  async failStalledExports(before: Date, now: Date): Promise<number> {
    const { count } = await this.prisma.reportExport.updateMany({
      where: { status: 'RUNNING', createdAt: { lt: before } },
      data: { status: 'FAILED', error: 'The export stopped. Please try again.', finishedAt: now },
    });
    return count;
  }
}
