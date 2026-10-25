import { Injectable } from '@nestjs/common';
import {
  addBusinessDays,
  type BookingHistoryResponse,
  type BookingRecord,
  type bookingHistoryQuerySchema,
  type BookingStatus,
  ErrorCode,
  type HistoryStatusFilter,
  toBusinessDate,
} from '@ennel/shared';
import { type z } from 'zod';
import { AppError } from '../../../common/errors/app-error';
import { Clock } from '../../../infrastructure/clock/clock';
import { GetMessPolicyService } from '../../mess-config/services/get-mess-policy.service';
import { BookingHistoryRepository } from '../repositories/booking-history.repository';

type HistoryQuery = z.output<typeof bookingHistoryQuerySchema>;

/** Spec §7 "Cancelled" also covers meals cancelled because the mess closed. */
const STATUSES: Record<HistoryStatusFilter, BookingStatus[]> = {
  COMPLETED: ['COMPLETED'],
  CANCELLED: ['CANCELLED', 'CANCELLED_BY_CLOSURE'],
  NO_SHOW: ['NO_SHOW'],
};
const ALL_FINAL = Object.values(STATUSES).flat();
const DEFAULT_LOOKBACK_DAYS = 30;

/**
 * My Bookings (Spec §7): final records only. Upcoming Booked meals stay on Home; a cancelled
 * upcoming meal is already final, so the default range runs to the end of the booking period.
 */
@Injectable()
export class BookingHistoryService {
  constructor(
    private readonly history: BookingHistoryRepository,
    private readonly policies: GetMessPolicyService,
    private readonly clock: Clock,
  ) {}

  async list(studentId: string, query: HistoryQuery): Promise<BookingHistoryResponse> {
    const today = toBusinessDate(this.clock.now());
    const policy = await this.policies.execute();
    const from = query.from ?? addBusinessDays(query.to ?? today, -DEFAULT_LOOKBACK_DAYS);
    const to = query.to ?? addBusinessDays(today, policy.bookingHorizonDays);
    const { items, total } = await this.history.list(studentId, {
      from,
      to,
      mealType: query.mealType,
      statuses: query.status ? STATUSES[query.status] : ALL_FINAL,
      page: query.page,
      pageSize: query.pageSize,
    });
    return { items, total, page: query.page, pageSize: query.pageSize, from, to };
  }

  async record(studentId: string, id: string): Promise<BookingRecord> {
    const record = await this.history.find(studentId, id);
    if (!record) throw new AppError(ErrorCode.NOT_FOUND, 'This booking was not found.');
    return record;
  }
}
