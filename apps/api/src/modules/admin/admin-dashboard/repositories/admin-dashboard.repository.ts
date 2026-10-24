import { Injectable } from '@nestjs/common';
import { BookingStatus, type BusinessDate, type DietType, type PendingWork } from '@ennel/shared';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

/** Seats in use (BR-CAP-2). */
const SEAT_STATUSES = [BookingStatus.BOOKED, BookingStatus.COMPLETED, BookingStatus.NO_SHOW];

const toDbDate = (date: BusinessDate) => new Date(`${date}T00:00:00Z`);
const fromDbDate = (date: Date): BusinessDate => date.toISOString().slice(0, 10);

export interface DietCount {
  mealId: string;
  dietType: DietType;
  count: number;
}

export interface MealDayCounts {
  date: BusinessDate;
  mealId: string;
  booked: number;
  attended: number;
  noShows: number;
}

export interface DayStatusCounts {
  date: BusinessDate;
  booked: number;
  completed: number;
  noShows: number;
}

/** Aggregates for the admin dashboard (Admin §C); all reads use indexed group-bys. */
@Injectable()
export class AdminDashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async dietCounts(date: BusinessDate): Promise<DietCount[]> {
    const rows = await this.prisma.booking.groupBy({
      by: ['mealId', 'dietType'],
      where: { mealDate: toDbDate(date), status: { in: SEAT_STATUSES } },
      _count: { _all: true },
    });
    return rows.map((row) => ({
      mealId: row.mealId,
      dietType: row.dietType,
      count: row._count._all,
    }));
  }

  /** Per meal and day, newest first, for show-up history (BR-FC-1) and today's attendance. */
  async mealDayCounts(from: BusinessDate, to: BusinessDate): Promise<MealDayCounts[]> {
    const range = { gte: toDbDate(from), lte: toDbDate(to) };
    const [bookings, attendance] = await Promise.all([
      this.prisma.booking.groupBy({
        by: ['mealDate', 'mealId', 'status'],
        where: { mealDate: range, status: { in: SEAT_STATUSES } },
        _count: { _all: true },
      }),
      this.prisma.attendanceRecord.groupBy({
        by: ['mealDate', 'mealId'],
        where: { mealDate: range, bookingId: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const days = new Map<string, MealDayCounts>();
    const entry = (date: Date, mealId: string) => {
      const key = `${fromDbDate(date)}#${mealId}`;
      const existing = days.get(key) ?? {
        date: fromDbDate(date),
        mealId,
        booked: 0,
        attended: 0,
        noShows: 0,
      };
      days.set(key, existing);
      return existing;
    };
    for (const row of bookings) {
      const day = entry(row.mealDate, row.mealId);
      day.booked += row._count._all;
      if (row.status === BookingStatus.NO_SHOW) day.noShows += row._count._all;
    }
    for (const row of attendance) entry(row.mealDate, row.mealId).attended += row._count._all;
    return [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
  }

  async dayStatusCounts(from: BusinessDate, to: BusinessDate): Promise<DayStatusCounts[]> {
    const rows = await this.prisma.booking.groupBy({
      by: ['mealDate', 'status'],
      where: {
        mealDate: { gte: toDbDate(from), lte: toDbDate(to) },
        status: { in: SEAT_STATUSES },
      },
      _count: { _all: true },
    });
    const days = new Map<string, DayStatusCounts>();
    for (const row of rows) {
      const date = fromDbDate(row.mealDate);
      const day = days.get(date) ?? { date, booked: 0, completed: 0, noShows: 0 };
      day.booked += row._count._all;
      if (row.status === BookingStatus.COMPLETED) day.completed += row._count._all;
      if (row.status === BookingStatus.NO_SHOW) day.noShows += row._count._all;
      days.set(date, day);
    }
    return [...days.values()];
  }

  async pendingWork(): Promise<PendingWork> {
    const [leaveApprovals, openComplaints, noShowAppeals, attendanceIssues] = await Promise.all([
      this.prisma.leave.count({ where: { status: 'PENDING' } }),
      this.prisma.complaint.count({ where: { status: { in: ['NEW', 'IN_REVIEW'] } } }),
      this.prisma.noShowAppeal.count({ where: { status: 'PENDING' } }),
      this.prisma.noShowEvent.count({ where: { status: 'HELD_FOR_REVIEW' } }),
    ]);
    return { leaveApprovals, openComplaints, noShowAppeals, attendanceIssues };
  }

  async activeMeals(): Promise<{ id: string; mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' }[]> {
    return this.prisma.meal.findMany({
      where: { isActive: true },
      select: { id: true, mealType: true },
    });
  }
}
