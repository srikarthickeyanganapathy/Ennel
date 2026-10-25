import { Injectable } from '@nestjs/common';
import {
  type BookingHistoryItem,
  type BookingRecord,
  type BookingStatus,
  type BusinessDate,
  type MealType,
} from '@ennel/shared';
import { type Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

const toDbDate = (date: BusinessDate) => new Date(`${date}T00:00:00Z`);

const HISTORY_SELECT = {
  id: true,
  mealDate: true,
  dietType: true,
  status: true,
  source: true,
  cancelledAt: true,
  lastActorType: true,
  createdAt: true,
  mealId: true,
  meal: { select: { mealType: true, displayName: true, serviceStartMinute: true } },
  slot: { select: { label: true, startMinute: true, endMinute: true } },
  attendanceRecord: { select: { source: true, verifiedAt: true, recordedAt: true } },
  noShowEvent: { select: { status: true, createdAt: true } },
} as const;
type HistoryRow = Prisma.BookingGetPayload<{ select: typeof HISTORY_SELECT }>;

export interface HistoryFilter {
  from: BusinessDate;
  to: BusinessDate;
  mealType?: MealType;
  statuses: BookingStatus[];
  page: number;
  pageSize: number;
}

/** A student's final booking records for My Bookings (Spec §7). */
@Injectable()
export class BookingHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    studentId: string,
    filter: HistoryFilter,
  ): Promise<{ items: BookingHistoryItem[]; total: number }> {
    const where: Prisma.BookingWhereInput = {
      studentId,
      mealDate: { gte: toDbDate(filter.from), lte: toDbDate(filter.to) },
      status: { in: filter.statuses },
      ...(filter.mealType && { meal: { mealType: filter.mealType } }),
      // A recurring meal the system cancelled (Default Booking turned off) was never the
      // student's booking to cancel, so it is not part of their history.
      NOT: { status: 'CANCELLED', lastActorType: 'SYSTEM' },
    };
    const [rows, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        select: HISTORY_SELECT,
        orderBy: [{ mealDate: 'desc' }, { meal: { serviceStartMinute: 'desc' } }],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { items: rows.map(toItem), total };
  }

  async find(studentId: string, id: string): Promise<BookingRecord | null> {
    const row = await this.prisma.booking.findFirst({
      where: { id, studentId },
      select: HISTORY_SELECT,
    });
    if (!row) return null;
    const closure =
      row.status === 'CANCELLED_BY_CLOSURE'
        ? await this.prisma.messClosureMeal.findFirst({
            where: { mealId: row.mealId, closure: { mealDate: row.mealDate, status: 'ACTIVE' } },
            select: { closure: { select: { title: true } } },
          })
        : null;
    return {
      ...toItem(row),
      slotStartMinute: row.slot.startMinute,
      slotEndMinute: row.slot.endMinute,
      bookedAt: row.createdAt.toISOString(),
      closureTitle: closure?.closure.title ?? null,
      noShow: row.noShowEvent
        ? { status: row.noShowEvent.status, recordedAt: row.noShowEvent.createdAt.toISOString() }
        : null,
    };
  }
}

function toItem(row: HistoryRow): BookingHistoryItem {
  return {
    id: row.id,
    date: row.mealDate.toISOString().slice(0, 10),
    mealType: row.meal.mealType,
    mealName: row.meal.displayName,
    slotLabel: row.slot.label,
    dietType: row.dietType,
    status: row.status,
    source: row.source,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    attendance: row.attendanceRecord
      ? {
          source: row.attendanceRecord.source,
          // BR-ATT-1: only a face verification carries a verification time.
          verifiedAt:
            row.attendanceRecord.source === 'FACE_VERIFICATION'
              ? (row.attendanceRecord.verifiedAt?.toISOString() ?? null)
              : null,
          recordedAt: row.attendanceRecord.recordedAt.toISOString(),
        }
      : null,
    isUpdatedByStaff: row.lastActorType === 'STAFF',
  };
}
